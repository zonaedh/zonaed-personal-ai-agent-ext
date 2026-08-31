/**
 * Typed wrappers around the chrome.* APIs we use. Every extension context
 * (side panel / popup / options / SW) calls through these so the surface area
 * is tiny and consistent.
 *
 * MV3 notes that matter here:
 *  - Content scripts are NOT declared persistently (no <all_urls>). We inject
 *    the reader bundle on demand via chrome.scripting + activeTab. If the user
 *    hasn't granted activeTab yet (first run), injection throws and we report
 *    needsActivation=true so the UI can explain how to grant access.
 *  - chrome.sidePanel.open() must be called in response to a user gesture
 *    (popup click, context menu, keyboard command). We route open requests
 *    through the background service worker in response to such gestures.
 */

import type {
  AutomationResult,
  AutomationStep,
  ContextTask,
  FormFieldInfo,
  PageContent,
  ScrapeResult,
} from '@/shared/types';
import type { LocalAgentBridge } from '@/shared/bridge';

/** On-demand content-script bundle path (resolved from bundle-info.json). */
let cachedContentScriptUrl: string | null = null;

/**
 * The plugin writes dist/bundle-info.json (bundleInfoJsonPath in vite.config).
 * We use it to find the exact output name of the on-demand content script so
 * nothing depends on a hardcoded generated path. Falls back to the
 * input-relative convention if the file is missing (dev edge cases).
 */
export async function resolveContentScriptUrl(): Promise<string> {
  if (cachedContentScriptUrl) return cachedContentScriptUrl;

  const urls: string[] = [];
  try {
    const info = (await (await fetch(chrome.runtime.getURL('bundle-info.json'))).json()) as unknown;
    collectStringValues(info, urls);
  } catch {
    // bundle-info.json absent — fall through to conventions
  }
  urls.push('src/content-script/index.js', 'content-script/index.js');

  for (const candidate of urls) {
    try {
      const res = await fetch(chrome.runtime.getURL(candidate), { method: 'HEAD' });
      if (res.ok) {
        cachedContentScriptUrl = candidate;
        return candidate;
      }
    } catch {
      // fetch() to a missing chrome-extension:// URL rejects — keep probing
    }
  }
  // Last resort: plugin's additional-input naming keeps the relative path.
  cachedContentScriptUrl = 'src/content-script/index.js';
  return cachedContentScriptUrl;
}

function collectStringValues(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    if (node.endsWith('.js') && node.includes('content-script')) out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStringValues(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectStringValues(value, out);
  }
}

/* ---------------------------------------------------------------------------
 * Tabs / windows
 * ------------------------------------------------------------------------- */

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error('No active tab found.');
  return tab;
}

export async function getActiveTabInfo(): Promise<{ url?: string; title?: string }> {
  const tab = await getActiveTab();
  return { url: tab.url, title: tab.title };
}

export async function getCurrentWindowId(): Promise<number> {
  const win = await chrome.windows.getLastFocused();
  return win.id ?? -1;
}

/** Open the side panel (must follow a user gesture; see module docstring). */
export async function openSidePanel(opts?: { tabId?: number; windowId?: number }): Promise<void> {
  const tabId = opts?.tabId;
  const windowId = opts?.windowId ?? (tabId === undefined ? await getCurrentWindowId() : undefined);
  if (tabId !== undefined) return chrome.sidePanel.open({ tabId });
  if (windowId !== undefined) return chrome.sidePanel.open({ windowId });
  throw new Error('openSidePanel needs a tabId or windowId');
}

/* ---------------------------------------------------------------------------
 * On-demand page reading (activeTab + scripting)
 * ------------------------------------------------------------------------- */

const MAX_EXTRACT_CHARS = 250_000;

/**
 * Inject the reader bundle into the active tab and pull back a
 * Readability-extracted article. Returns needsActivation=true when the page is
 * scriptable but activeTab wasn't granted yet.
 */
export async function readActiveTabPage(): Promise<PageContent> {
  let tab;
  try {
    tab = await getActiveTab();
  } catch {
    return { ok: false, error: 'No active tab available.' };
  }
  if (tab.id === undefined) return { ok: false, error: 'This tab cannot be scripted.' };

  if (!isExtensibleUrl(tab.url)) {
    return {
      ok: false,
      error:
        'This is a browser-protected page (chrome://, Web Store, etc.) and cannot be read.',
    };
  }

  try {
    // 1. Inject the bridge bundle (defines globalThis.__localAgentBridge).
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [await resolveContentScriptUrl()] });
    // 2. Call it. This `func` executes in the same isolated world as the
    //    bundle injected above, so the bridge is reachable.
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: callBridgeExtract });
    const page = result[0]?.result as PageContent | undefined;
    if (!page) return { ok: false, error: 'Page reader returned no result.' };
    if (page.ok && page.text) page.text = page.text.slice(0, MAX_EXTRACT_CHARS);
    return page;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cannot access|extension context invalid|permission/i.test(msg)) {
      return {
        ok: false,
        error:
          'Local AI can’t read this tab yet. Click the extension icon (or press the shortcut) to grant access to this page.',
        needsActivation: true,
      };
    }
    return { ok: false, error: `Could not read this page: ${msg}` };
  }
}

/** Executed inside the page (isolated world): delegates to the injected bridge. */
function callBridgeExtract(): PageContent | undefined {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.extractPage();
}

/* ---------------------------------------------------------------------------
 * Multi-tab context (Phase 2): explicit user-attached tabs.
 * Reading a NON-active tab requires real host access, so the UI asks via
 * chrome.permissions.request (optional_host_permissions) — one combined
 * dialog listing exactly the sites the user picked. Never implicit (§4).
 * ------------------------------------------------------------------------- */

export async function listOpenTabs(): Promise<chrome.tabs.Tab[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((t) => t.url && isExtensibleUrl(t.url));
}

export function tabOrigin(tab: chrome.tabs.Tab): string | null {
  try {
    if (!tab.url) return null;
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

export async function hasOriginAccess(origin: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [`${origin}/*`] });
  } catch {
    return false;
  }
}

/** Must be called directly from a user-gesture handler (popup/dialog click). */
export async function ensureOriginsAccess(origins: string[]): Promise<boolean> {
  const unique = [...new Set(origins.filter(Boolean))].map((o) => `${o}/*`);
  if (unique.length === 0) return true;
  const granted = await chrome.permissions.contains({ origins: unique });
  if (granted) return true;
  try {
    return await chrome.permissions.request({ origins: unique });
  } catch {
    return false;
  }
}

/** Inject the bridge bundle into a specific tab (idempotent, cheap). */
async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [await resolveContentScriptUrl()],
  });
}

/**
 * Read a specific (possibly background) tab. Requires host permission for the
 * tab's origin — see ensureOriginsAccess.
 */
export async function readTabById(tabId: number): Promise<PageContent> {
  try {
    await injectBridge(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: callBridgeExtract,
    });
    const page = result[0]?.result as PageContent | undefined;
    if (!page) return { ok: false, error: 'Page reader returned no result.' };
    if (page.ok && page.text) page.text = page.text.slice(0, MAX_EXTRACT_CHARS);
    return page;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cannot access|permission/i.test(msg)) {
      return { ok: false, error: 'No access to this tab. Grant the site first.', needsActivation: true };
    }
    return { ok: false, error: `Could not read tab: ${msg}` };
  }
}

/* ---------------------------------------------------------------------------
 * Bridge calls for scrape / forms / automation (Phase 3)
 * ------------------------------------------------------------------------- */

function callBridgeScrape(): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.scrapePage();
}

function callBridgeDetect(): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.detectFormFields();
}

function callBridgeFill(values: { key: string; value: string }[]): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.fillFormFields(values);
}

function callBridgeApply(
  actions: AutomationStep[],
  opts: { allowConfirmed: boolean },
): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.applyActions(actions, opts);
}

async function callBridgeInTab<R, A extends unknown[] = []>(
  tabId: number,
  func: (...args: A) => unknown,
  args?: A,
): Promise<R> {
  await injectBridge(tabId);
  const injection: chrome.scripting.ScriptInjection<A, unknown> = {
    target: { tabId },
    func,
    ...(args && args.length > 0 ? { args } : {}),
  } as chrome.scripting.ScriptInjection<A, unknown>;
  const result = await chrome.scripting.executeScript(injection);
  return result[0]?.result as R;
}

export async function scrapeTab(tabId: number): Promise<ScrapeResult> {
  return callBridgeInTab<ScrapeResult>(tabId, callBridgeScrape);
}

export async function scrapeActiveTab(): Promise<ScrapeResult> {
  const tab = await getActiveTab();
  if (tab.id === undefined) throw new Error('No active tab found.');
  return scrapeTab(tab.id);
}

export async function detectFormFields(tabId: number): Promise<FormFieldInfo[]> {
  return callBridgeInTab<FormFieldInfo[]>(tabId, callBridgeDetect);
}

export async function fillFormFields(
  tabId: number,
  values: { key: string; value: string }[],
): Promise<AutomationResult> {
  return callBridgeInTab<AutomationResult, [{ key: string; value: string }[]]>(tabId, callBridgeFill, [values]);
}

export async function applyActionsInTab(
  tabId: number,
  actions: AutomationStep[],
  opts: { allowConfirmed: boolean },
): Promise<AutomationResult> {
  return callBridgeInTab<AutomationResult, [AutomationStep[], { allowConfirmed: boolean }]>(
    tabId,
    callBridgeApply,
    [actions, opts],
  );
}

function callBridgeExtractWhatsApp(): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.extractWhatsAppLeads?.();
}

function callBridgeSendWhatsApp(text: string): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.sendWhatsAppMessage?.(text);
}

function callBridgeOpenWhatsApp(nameOrPhone: string): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.openWhatsAppChat?.(nameOrPhone);
}

export async function extractWhatsAppLeadsFromTab(tabId: number): Promise<any[]> {
  return callBridgeInTab<any[]>(tabId, callBridgeExtractWhatsApp);
}

export async function sendWhatsAppMessageInTab(tabId: number, text: string): Promise<boolean> {
  return callBridgeInTab<boolean, [string]>(tabId, callBridgeSendWhatsApp, [text]);
}

export async function openWhatsAppChatInTab(tabId: number, nameOrPhone: string): Promise<boolean> {
  return callBridgeInTab<boolean, [string]>(tabId, callBridgeOpenWhatsApp, [nameOrPhone]);
}

export async function findWhatsAppTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  return tabs[0];
}

function callBridgeExtractYouTube(): unknown {
  const bridge: LocalAgentBridge | undefined = (
    globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }
  ).__localAgentBridge;
  return bridge?.extractYouTubeData?.();
}

export async function extractYouTubeDataFromTab(tabId: number): Promise<import('@/shared/types').YouTubeVideoData> {
  return callBridgeInTab<import('@/shared/types').YouTubeVideoData>(tabId, callBridgeExtractYouTube);
}

export async function findYouTubeTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/watch*' });
  if (tabs[0]) return tabs[0];
  const shortTabs = await chrome.tabs.query({ url: '*://youtu.be/*' });
  return shortTabs[0];
}

/** Pages where chrome.scripting is disallowed or meaningless. */
function isExtensibleUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !/^(chrome|chrome-search|chrome-extension|edge|about|devtools|view-source|data):/i.test(url);
}

/* ---------------------------------------------------------------------------
 * Visible-tab capture (Phase 2 OCR)
 * ------------------------------------------------------------------------- */

/** Returns a data: URL of the visible tab viewport (PNG). Needs activeTab. */
export async function captureVisibleTab(): Promise<string> {
  const tab = await getActiveTab();
  if (tab.windowId === undefined) throw new Error('No window for active tab.');
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
}

/* ---------------------------------------------------------------------------
 * Messaging helpers
 * ------------------------------------------------------------------------- */

export interface RuntimeResponse<T = undefined> {
  ok: boolean;
  data?: T;
  text?: string;
  error?: string;
}

export function sendToBackground<TResponse = undefined>(
  message: unknown,
): Promise<RuntimeResponse<TResponse>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<TResponse>>;
}

/** Queue a context-menu/popup task in the background + wake it to open panel. */
export async function queuePendingTask(task: ContextTask): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'QUEUE_PENDING_TASK', task });
}

export async function openOptionsPage(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    await chrome.runtime.openOptionsPage();
  } else {
    window.open('/src/options/index.html', '_blank');
  }
}