/**
 * MV3 background service worker — deliberately THIN (spec §3).
 *
 * The service worker is killed after ~30s idle, so no AI generation or
 * multi-step automation ever lives here: streaming happens in the side panel,
 * page reading happens on-demand via chrome.scripting, and long-running work
 * (Phase 3/4) will use chrome.alarms keepalive heartbeats or an offscreen
 * document. This worker only:
 *   1. registers context menus (summarize / rewrite / translate / ask-page)
 *   2. routes popup + context-menu tasks to the side panel via
 *      chrome.storage + a TASK_QUEUED broadcast
 *   3. opens the side panel in response to user gestures (popup, command,
 *      context menu — chrome.sidePanel.open() requires a gesture)
 *   4. keeps alarm/keepalive plumbing for later phases
 */

import type { ContextTask, ContextTaskKind } from '@/shared/types';
import { pendingTaskStorage, settingsStorage } from '@/lib/storage';
import { readActiveTabPage, readTabById, hasOriginAccess, type RuntimeResponse } from '@/lib/chrome';
import { makeTask } from '@/lib/tasks';
import { listWatchTasks, updateWatchTask, hashText } from '@/lib/watch';
import { appendLog } from '@/db/db';
import { generateGeminiText } from '@/lib/gemini';

/* ---------------------------------------------------------------------------
 * Context menus
 * ------------------------------------------------------------------------- */

const MENU_TASK: Record<string, ContextTaskKind> = {
  'ctx:summarize': 'summarize',
  'ctx:rewrite': 'rewrite',
  'ctx:translate': 'translate',
  'ctx:ask-page': 'ask-page',
  'ctx:ocr': 'ocr',
};

async function createContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll().catch(() => undefined);
  const create = (
    id: string,
    title: string,
    contexts: chrome.contextMenus.CreateProperties['contexts'],
  ): void => {
    chrome.contextMenus.create({ id, title, contexts });
  };
  create('ctx:summarize', 'Summarize selection with Local AI', ['selection']);
  create('ctx:rewrite', 'Rewrite selection with Local AI', ['selection']);
  create('ctx:translate', 'Translate selection with Local AI', ['selection']);
  create('ctx:ask-page', 'Ask Local AI about this page', ['page']);
  create('ctx:ocr', 'Extract text from screenshot (OCR)', ['page', 'image', 'selection']);
}

// Automatically open the side panel when the user clicks the toolbar action icon (Chrome 116+)
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn('[local-ai] setPanelBehavior error:', err);
  });
}

// Fallback click listener to guarantee opening side panel across all Chromium versions
chrome.action?.onClicked?.addListener((tab) => {
  if (tab?.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
      console.warn('[local-ai] sidePanel.open by tabId failed:', err);
    });
  } else {
    chrome.windows.getLastFocused().then((win) => {
      if (win?.id !== undefined) {
        chrome.sidePanel.open({ windowId: win.id }).catch((err) => {
          console.warn('[local-ai] sidePanel.open by windowId failed:', err);
        });
      }
    });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  void createContextMenus();
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  }
  if (details.reason === 'install') {
    // First run: surface the settings page so permissions/shortcuts are clear.
    void chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void createContextMenus();
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const kind = MENU_TASK[info.menuItemId as string];
  if (!kind) return;
  const selection = info.selectionText ?? '';
  // Context-menu invocation grants activeTab — read the page right now for
  // ask-page tasks so the panel doesn't need to re-request access.
  const buildTask = async (): Promise<ContextTask> => {
    const base: Partial<ContextTask> = {
      selection: selection || undefined,
      pageTitle: tab?.title,
      pageUrl: tab?.url,
    };
    if (kind === 'translate') {
      const settings = await settingsStorage.get<{ translateTargetLang?: string }>();
      base.targetLang = settings?.translateTargetLang ?? 'English';
    }
    if (kind === 'ask-page') {
      const page = await readActiveTabPage();
      base.pageText = page.ok ? (page.text ?? '') : undefined;
    }
    return makeTask(kind, base);
  };
  void buildTask().then((task) => queueTaskForPanel(task));
});

/* ---------------------------------------------------------------------------
 * Keyboard shortcut (Ctrl+Shift+Z) — opens the panel (§4 Phase 1)
 * ------------------------------------------------------------------------- */

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') void openPanelForActiveTab();
});

/* ---------------------------------------------------------------------------
 * Side panel plumbing
 * ------------------------------------------------------------------------- */

async function openPanelForActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      await chrome.sidePanel.open({ tabId: tab.id });
      return;
    }
    const win = await chrome.windows.getLastFocused();
    if (win?.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
  } catch (err) {
    // open() throws when called outside a user gesture — log, don't crash.
    console.warn('[local-ai] sidePanel.open failed:', err);
  }
}

/** Persist the task, wake the panel, and open it (gesture required). */
async function queueTaskForPanel(task: ContextTask): Promise<void> {
  await pendingTaskStorage.set(task);
  // Live-update an already-open panel; it also re-checks storage on mount.
  try {
    await chrome.runtime.sendMessage({ type: 'TASK_QUEUED', taskId: task.id });
  } catch {
    // No open receiver (panel closed) — that's fine, storage wins.
  }
  await openPanelForActiveTab();
}

/* ---------------------------------------------------------------------------
 * Message router (popup / panel -> worker)
 * ------------------------------------------------------------------------- */

async function handleMessage(message: unknown): Promise<RuntimeResponse> {
  const msg = message as { type?: string; task?: ContextTask };
  switch (msg?.type) {
    case 'PING':
      return { ok: true };
    case 'OPEN_SIDE_PANEL':
      await openPanelForActiveTab();
      return { ok: true };
    case 'QUEUE_PENDING_TASK':
      if (!msg.task) return { ok: false, error: 'Missing task' };
      await queueTaskForPanel(msg.task);
      return { ok: true };
    case 'GHOSTWRITER_REQUEST': {
      const settings = await settingsStorage.get<{ geminiApiKey?: string }>();
      const prompt = (msg as any).prompt;
      if (!prompt) return { ok: false, error: 'Missing prompt' };

      let replyText = '';
      if (settings?.geminiApiKey) {
        try {
          replyText = await generateGeminiText(settings.geminiApiKey, prompt, 'gemini-2.5-flash');
        } catch (err: any) {
          return { ok: false, error: err?.message || 'Gemini error' };
        }
      } else {
        return { ok: false, error: 'Please set your Gemini API key in extension settings.' };
      }
      return { ok: true, text: replyText.trim() };
    }
    default:
      return { ok: false, error: `Unknown message type: ${String(msg?.type ?? '(none)')}` };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the message channel open for the async response
});

/* ---------------------------------------------------------------------------
 * Keepalive scaffolding (Phase 3/4)
 *
 * MV3 kills idle service workers after ~30s. Long-running automation must be
 * driven in slices via chrome.alarms instead of a single long-lived call.
 * ensureKeepAlive()/stopKeepAlive() are exported for the automation runner and
 * deliberately NOT wired to anything in Phase 1 (keep the worker thin).
 * ------------------------------------------------------------------------- */

const KEEPALIVE_ALARM = 'keepalive-heartbeat';
const KEEPALIVE_STATE_KEY = 'automation-heartbeat';

export function ensureKeepAlive(): void {
  // Minimum period is 0.5 minutes in Chrome; 30s slices are plenty for
  // resuming work without burning CPU.
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  void chrome.storage.local.set({
    [`local-ai-agent:${KEEPALIVE_STATE_KEY}`]: { active: true, since: Date.now() },
  });
}

export function stopKeepAlive(): void {
  chrome.alarms.clear(KEEPALIVE_ALARM);
  void chrome.storage.local.remove(`local-ai-agent:${KEEPALIVE_STATE_KEY}`);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) return; // heartbeat only resets idle timer
  if (alarm.name.startsWith('watch-')) void handleWatchAlarm(alarm.name.slice('watch-'.length));
});

/* ---------------------------------------------------------------------------
 * Scheduled page watch (Phase 4) — alarm-driven change detection.
 * Only reads pages whose site the user explicitly granted access to
 * (via the multi-tab attach flow) and only while a matching tab is open.
 * ------------------------------------------------------------------------- */

async function handleWatchAlarm(taskId: string): Promise<void> {
  const task = (await listWatchTasks()).find((t) => t.id === taskId);
  if (!task) return;

  let origin: string | null = null;
  try {
    origin = new URL(task.url).origin;
  } catch {
    return;
  }
  if (!(await hasOriginAccess(origin))) return; // silent skip — user revoked access

  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  const tab = tabs[0];
  if (tab?.id === undefined) return; // page isn't open — nothing to check

  const page = await readTabById(tab.id);
  if (!page.ok || !page.text) return;

  const hash = hashText(page.text);
  const changed = task.lastHash !== undefined && task.lastHash !== hash;
  await updateWatchTask(taskId, {
    lastHash: hash,
    lastTitle: page.title,
    lastCheckedAt: Date.now(),
  });

  if (changed) {
    await chrome.notifications.create(`watch-${taskId}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Local AI — page changed',
      message: `“${task.label}” has new content since the last check.`,
    });
    await appendLog('watch', `Detected change on ${task.label}`, task.url).catch(() => undefined);
  }
}