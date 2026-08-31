import { create } from 'zustand';
import {
  deleteChat,
  getChat,
  listChatMetas,
  upsertChat,
  type StoredChat,
} from '@/db/db';
import { readActiveTabPage, openOptionsPage } from '@/lib/chrome';
import { streamChat, toOllamaMessages, type ChatRoleMessageLite } from '@/lib/ollama';
import { streamGeminiChat, isGeminiModel } from '@/lib/gemini';
import {
  streamOpenAICompatibleChat,
  isCloudModel,
  parseCloudModel,
} from '@/lib/openai-compatible';
import { getRouteCandidates, isTransientCapacityError } from '@/lib/quota-router';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { buildPersonalizedPreamble, detectAndLearnMemories } from '@/lib/memory-skills';
import { profileTone } from '@/lib/tone-profiler';
import { shouldUseDraftMode, buildDraftInstruction, isDraftApproval, buildFullDraftInstruction } from '@/lib/chain-of-draft';
import { buildTaskHint, buildTaskUserPrompt, taskNeedsContent } from '@/lib/tasks';
import { streamServerProxyChat } from '@/lib/server-proxy';
import { exportToGoogleDocs } from '@/lib/marketing-plan';
import { exportToGoogleSheets } from '@/lib/sheets-export';
import { parseThinkingContent } from '@/components/chat/thinking-box';
import { uid } from '@/lib/util';
import type { ChatAttachment, ChatMessage, ChatSessionMeta, ContextTask } from '@/shared/types';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';

interface ChatState {
  sessions: ChatSessionMeta[];
  currentSessionId: number | null;
  messages: ChatMessage[];
  /** Session-scoped context attachments (page/selection/tabs). */
  contextSlots: ChatAttachment[];
  isGenerating: boolean;
  abortController: AbortController | null;
  historyOpen: boolean;

  boot(): Promise<void>;
  newSession(): Promise<void>;
  openSession(id: number): Promise<void>;
  deleteSession(id: number): Promise<void>;
  stop(): void;
  sendText(text: string): Promise<void>;
  regenerateLast(): Promise<void>;
  retryError(): Promise<void>;
  addContextSlot(slot: ChatAttachment): Promise<void>;
  removeContextSlot(index: number): Promise<void>;
  handlePendingTask(task: ContextTask): Promise<void>;
  setHistoryOpen(open: boolean): void;
}

/* --------------------------------------------------------------------------
 * Module-level helpers shared by the store actions.
 * ------------------------------------------------------------------------- */

function friendlyChatError(err: unknown, model: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/model .*not found|not found/i.test(raw) && /model/i.test(raw)) {
    return `Model "${model}" isn't pulled yet. Run \`ollama pull ${model}\` in a terminal, then retry.`;
  }
  if (/could not reach|couldn't reach|failed to fetch|offline/i.test(raw)) {
    return 'Could not reach the local Ollama server. Start Ollama and try again.';
  }
  if (raw.includes('timed out')) {
    return 'Ollama timed out (it may still be loading the model). Try again in a moment.';
  }
  return raw || 'Unknown error while generating.';
}

export type ExportIntent = 'google-doc' | 'google-sheet' | null;

export function detectExportIntent(userText: string): ExportIntent {
  const lower = userText.toLowerCase();

  // Google Sheet signals
  if (
    /\b(google\s*sheet|google\s*sheets|google\s*spreadsheet|in\s*sheet|in\s*sheets|sheets\.new|to\s*sheet|to\s*sheets|sheet\s*e|sheet\s*a)\b/i.test(lower) ||
    /(গুগল\s*শীট|গুগল\s*শিট|শীটে|শিটে|শীট\s*এ|শিট\s*এ)/i.test(lower)
  ) {
    return 'google-sheet';
  }

  // Google Doc signals
  if (
    /\b(google\s*doc|google\s*docs|google\s*document|in\s*doc|in\s*docs|docs\.new|to\s*doc|to\s*docs|doc\s*e|doc\s*a)\b/i.test(lower) ||
    /(গুগল\s*ডক|ডকে|ডক\s*এ)/i.test(lower)
  ) {
    return 'google-doc';
  }

  return null;
}

function titleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  const t = (first?.content ?? 'New chat').trim();
  return t.length > 60 ? `${t.slice(0, 60).trimEnd()}…` : t;
}

/* --------------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------------- */

export const useChatStore = create<ChatState>()((set, get) => {
  let persistTimer: number | undefined;

  const refreshSessions = async (): Promise<void> => {
    try {
      const sessions = await listChatMetas(200);
      set({ sessions });
    } catch {
      // Dexie unavailable (e.g. plain-browser dev preview) — non-fatal
    }
  };

  /** Create the StoredChat row the first time a session gets content. */
  const ensureSession = async (
    messages: ChatMessage[],
    slots: ChatAttachment[],
  ): Promise<number> => {
    const existing = get().currentSessionId;
    if (existing !== null) return existing;
    const model =
      useOllamaStore.getState().selectedModel ?? useSettingsStore.getState().lastModel ?? 'gemini-3.7-flash';
    const id = await upsertChat({
      title: titleFromMessages(messages),
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages,
      contextSlots: slots,
      searchText: '',
    });
    return id;
  };

  const persistSession = async (
    sessionId: number | null,
    messages: ChatMessage[],
    slots: ChatAttachment[],
  ): Promise<void> => {
    if (sessionId === null) return;
    const id = await upsertChat({
      id: sessionId,
      title: titleFromMessages(messages),
      model:
        useOllamaStore.getState().selectedModel ?? useSettingsStore.getState().lastModel ?? 'gemini-3.7-flash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages,
      contextSlots: slots,
      searchText: '',
    });
    if (get().currentSessionId === null) set({ currentSessionId: id });
  };

  const throttledPersist = (sessionId: number | null): void => {
    if (persistTimer !== undefined || sessionId === null) return;
    persistTimer = window.setTimeout(() => {
      persistTimer = undefined;
      void persistSession(sessionId, get().messages, get().contextSlots);
    }, 1500);
  };

  const patchMessage = (id: string, patch: Partial<ChatMessage>): void => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  };

  /**
   * Append a user message and stream the assistant answer token-by-token.
   * This is the only path into Ollama /api/chat from the chat UI.
   */
  const postUserTurn = async (rawText: string, slotsOverride?: ChatAttachment[]): Promise<void> => {
    const text = rawText.trim();
    if (!text || get().isGenerating) return;

    const settings = useSettingsStore.getState();
    const ollama = useOllamaStore.getState();

    const activeModel = (await ollama.ensureModel()) ?? settings.lastModel ?? 'gemini-3.7-flash';
    const isGemini = isGeminiModel(activeModel);
    const isCloud = isCloudModel(activeModel);

    const hasProxy = Boolean(settings.serverProxyUrl || settings.pinSessionToken);

    if (isGemini) {
      if (!settings.geminiApiKey && !hasProxy) {
        useToastStore.getState().push(
          'error',
          'Gemini API Key missing',
          'Opening Settings to configure your Gemini API Key.',
        );
        void openOptionsPage();
        return;
      }
    } else if (isCloud) {
      const { provider } = parseCloudModel(activeModel);
      const key =
        provider === 'groq'
          ? settings.groqApiKey
          : provider === 'deepseek'
          ? settings.deepSeekApiKey
          : settings.openRouterApiKey;
      if (!key && !hasProxy) {
        useToastStore.getState().push(
          'error',
          `${provider.toUpperCase()} API Key missing`,
          `Opening Settings to enter your ${provider.toUpperCase()} API Key.`,
        );
        void openOptionsPage();
        return;
      }
    } else {
      if (ollama.status === 'offline') {
        void ollama.refresh(true);
        useToastStore.getState().push(
          'error',
          'Ollama isn’t running',
          'Start Ollama, or switch to Gemini / Groq / DeepSeek in the model dropdown.',
        );
        return;
      }
    }

    if (get().abortController) return;

    const model = activeModel;
    const slots = slotsOverride ?? get().contextSlots;
    let messages = [...get().messages];
    // Regenerate path: the tail already equals the text being resent — drop it
    // so the conversation doesn't record an identical user turn twice.
    const tail = messages[messages.length - 1];
    if (tail?.role === 'user' && tail.content.trim() === text) messages = messages.slice(0, -1);

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, createdAt: Date.now() };
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      model,
      status: 'streaming',
    };
    const next = [...messages, userMsg, assistantMsg];
    const sessionId = await ensureSession(next, slots);
    set({ messages: next, currentSessionId: sessionId, isGenerating: true });
    await persistSession(sessionId, next, slots);

    const controller = new AbortController();
    set({ abortController: controller });

    // Auto-detect and learn new user preferences/facts in background
    void detectAndLearnMemories(text).then((newMem) => {
      if (newMem) {
        useToastStore.getState().push('info', '🧠 Saved to Memory', `Learned: "${newMem.fact}"`);
      }
    });

    // Feature 1: Adaptive Tone Profiler - auto-switch language based on user text (Bangla/Banglish vs English)
    const toneProfile = profileTone(text);
    const activeLanguage =
      toneProfile.language === 'bn'
        ? 'bn'
        : toneProfile.language === 'en'
        ? 'en'
        : settings.language;

    if (activeLanguage !== settings.language) {
      void useSettingsStore.getState().update({ language: activeLanguage });
    }

    // Pre-flight memory & skills auto-detection (includes output styles, few-shot, knowledge)
    const { preamble, matchedSkills, outputStyle } = await buildPersonalizedPreamble(text);
    if (matchedSkills.length > 0) {
      useToastStore.getState().push(
        'info',
        '⚡ Active Skill Applied',
        matchedSkills.map((s) => s.name).join(', '),
      );
    }
    if (outputStyle) {
      useToastStore.getState().push(
        'info',
        '📋 Output Style',
        `Using: ${outputStyle.name}`,
      );
    }

    // Feature 6: Chain-of-Draft - outline-first for complex content
    let draftInstruction = '';
    if (shouldUseDraftMode(text) && !isDraftApproval(text)) {
      draftInstruction = buildDraftInstruction();
    } else if (isDraftApproval(text)) {
      // Find the last assistant outline to expand
      const lastOutline = [...next].reverse().find(
        (m) => m.role === 'assistant' && m.status !== 'error',
      );
      if (lastOutline?.content) {
        draftInstruction = buildFullDraftInstruction(lastOutline.content);
      }
    }

    const localModels = useOllamaStore.getState().models;
    const candidates = getRouteCandidates(model, settings, localModels);

    let acc = '';
    let completedSuccessfully = false;

    try {
      for (let candidateIdx = 0; candidateIdx < candidates.length; candidateIdx++) {
        const candidate = candidates[candidateIdx];
        if (!candidate) continue;
        const isCandidateGemini = isGeminiModel(candidate.model);
        const isCandidateCloud = isCloudModel(candidate.model);

        if (candidateIdx > 0) {
          useToastStore.getState().push(
            'info',
            '⚡ Auto-Switching Route',
            `Failing over to ${candidate.label} due to temporary high demand...`,
          );
          patchMessage(assistantMsg.id, { model: candidate.model });
        }

        // Dynamically calculate context budget based on provider limits
        const isCandidateGroq = isCandidateCloud && parseCloudModel(candidate.model).provider === 'groq';
        const effectiveContextChars = isCandidateGroq
          ? Math.min(settings.maxContextChars, 12000)
          : settings.maxContextChars;

        const baseSystemPrompt = buildSystemPrompt({
          contextSlots: slots,
          maxContextChars: effectiveContextChars,
          language: activeLanguage,
          exportIntent: detectExportIntent(text),
        });

        const systemPrompt = [baseSystemPrompt, preamble, draftInstruction].filter(Boolean).join('\n\n');

        const historySlice = isCandidateGroq && slots.length > 0
          ? next.slice(-10, -1)
          : next.slice(0, -1);

        const requestMessages: ChatRoleMessageLite[] = [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...toOllamaMessages(historySlice),
        ];

        try {
          let streamGenerator: AsyncGenerator<import('@/lib/ollama').ChatStreamEvent, void, void>;

          if (isCandidateGemini) {
            // If direct client API key is provided, use direct client streaming; otherwise use secure Vercel proxy
            if (settings.geminiApiKey && settings.geminiApiKey.trim()) {
              streamGenerator = streamGeminiChat({
                apiKey: settings.geminiApiKey,
                model: candidate.model,
                messages: requestMessages,
                systemPrompt,
                signal: controller.signal,
              });
            } else {
              streamGenerator = streamServerProxyChat({
                proxyUrl: settings.serverProxyUrl,
                sessionToken: settings.pinSessionToken,
                pin: settings.masterPin,
                model: candidate.model,
                messages: requestMessages,
                systemPrompt,
                signal: controller.signal,
              });
            }
          } else if (isCandidateCloud) {
            const { provider, rawModel } = parseCloudModel(candidate.model);
            const apiKey =
              (provider === 'groq'
                ? settings.groqApiKey
                : provider === 'deepseek'
                ? settings.deepSeekApiKey
                : settings.openRouterApiKey) || '';

            if (apiKey && apiKey.trim()) {
              streamGenerator = streamOpenAICompatibleChat({
                apiKey,
                provider,
                rawModel,
                messages: requestMessages,
                systemPrompt,
                signal: controller.signal,
              });
            } else {
              streamGenerator = streamServerProxyChat({
                proxyUrl: settings.serverProxyUrl,
                sessionToken: settings.pinSessionToken,
                pin: settings.masterPin,
                model: candidate.model,
                messages: requestMessages,
                systemPrompt,
                signal: controller.signal,
              });
            }
          } else {
            streamGenerator = streamChat({
              baseUrl: settings.ollamaBaseUrl,
              model: candidate.model,
              messages: requestMessages,
              signal: controller.signal,
            });
          }

          for await (const evt of streamGenerator) {
            acc += evt.delta;
            patchMessage(assistantMsg.id, { content: acc, model: candidate.model });
            throttledPersist(sessionId);
            if (evt.done) patchMessage(assistantMsg.id, { status: 'done' });
          }

          if (controller.signal.aborted) {
            patchMessage(assistantMsg.id, { status: 'stopped', content: acc });
            return;
          } else if (acc === '') {
            throw new Error('The model returned an empty response.');
          }

          completedSuccessfully = true;
          break; // Streaming finished successfully!
        } catch (err: any) {
          if (err instanceof Error && err.name === 'AbortError') {
            patchMessage(assistantMsg.id, { status: 'stopped', content: acc });
            return;
          }

          const isTransient = isTransientCapacityError(err);
          // If it's a transient capacity/quota error and we haven't received substantial output yet, try next candidate
          if (isTransient && candidateIdx < candidates.length - 1 && !acc) {
            console.warn(
              `[Quota Router] Candidate ${candidate.model} busy (${err?.message}). Routing to next provider...`,
            );
            continue;
          }

          // Final error handling
          const message = isCandidateGemini
            ? (err instanceof Error ? err.message : String(err))
            : friendlyChatError(err, candidate.model);
          patchMessage(assistantMsg.id, { status: 'error', error: message });
          useToastStore.getState().push('error', 'Generation failed', message);
          if (!isCandidateGemini && !isCandidateCloud) void ollama.refresh(true);
          return;
        }
      }

      // Feature: Automatic Google Docs / Google Sheets Export when mentioned in prompt
      if (completedSuccessfully && acc.trim()) {
        const exportIntent = detectExportIntent(text);
        const { content: cleanBody } = parseThinkingContent(acc, false);
        const finalContent = cleanBody.trim() || acc.trim();

        if (exportIntent === 'google-doc') {
          void exportToGoogleDocs(finalContent).then((res) => {
            useToastStore.getState().push(
              'success',
              '🚀 Google Doc Ready!',
              res.openedNew
                ? 'New Google Doc opened. Press Ctrl+V to paste your content.'
                : 'Switched to open Google Doc. Press Ctrl+V to paste your content.',
            );
          });
        } else if (exportIntent === 'google-sheet') {
          void exportToGoogleSheets(finalContent).then((res) => {
            useToastStore.getState().push(
              'success',
              '🚀 Google Sheet Ready!',
              res.openedNew
                ? 'New Google Sheet opened. Press Ctrl+V to paste table cells.'
                : 'Switched to open Google Sheet. Press Ctrl+V to paste table cells.',
            );
          });
        }
      }
    } finally {
      window.clearTimeout(persistTimer);
      persistTimer = undefined;
      set({ isGenerating: false, abortController: null });
      await persistSession(sessionId, get().messages, get().contextSlots);
      await refreshSessions();
    }
  };

  /** Regenerate the last assistant turn (drops it, then resends its user msg). */
  const regenerateOrRetry = async (onlyFailed: boolean): Promise<void> => {
    const msgs = get().messages;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const last = msgs[msgs.length - 1];
    if (onlyFailed && last?.role === 'assistant' && last.status !== 'error') return;
    const keep = last?.role === 'assistant' ? msgs.slice(0, msgs.length - 1) : msgs;
    set({ messages: keep });
    const text = msgs[lastUserIdx]?.content ?? '';
    await postUserTurn(text);
  };

  const addContextSlot = async (slot: ChatAttachment): Promise<void> => {
    set({ contextSlots: [...get().contextSlots, slot] });
    if (get().currentSessionId !== null) {
      await persistSession(get().currentSessionId, get().messages, get().contextSlots);
    }
  };

  const removeContextSlot = async (index: number): Promise<void> => {
    const slots = get().contextSlots.filter((_, i) => i !== index);
    set({ contextSlots: slots });
    if (get().currentSessionId !== null) {
      await persistSession(get().currentSessionId, get().messages, slots);
    }
  };

  const handlePendingTask = async (task: ContextTask): Promise<void> => {
    const toasts = useToastStore.getState();
    await get().newSession();

    if (task.kind === 'quick-chat') {
      await postUserTurn(task.text ?? '');
      return;
    }

    if (task.kind === 'ocr') {
      useToolsStore.getState().open('ocr');
      return;
    }

    if (task.kind === 'ask-page') {
      let text = task.pageText ?? '';
      if (!text) {
        const page = await readActiveTabPage();
        if (!page.ok) {
          toasts.push('error', 'Couldn’t attach the page', page.error ?? 'Unknown error.');
          return;
        }
        text = page.text ?? '';
      }
      await addContextSlot({
        kind: 'page',
        label: task.pageTitle ?? 'Current tab',
        content: text,
        url: task.pageUrl,
        addedAt: Date.now(),
      });
      toasts.push('success', 'Page attached', 'Ask your question below.');
      return;
    }

    if (taskNeedsContent(task)) {
      const content = task.kind === 'extract-page' ? (task.pageText ?? '') : (task.selection ?? '');
      if (!content.trim()) {
        toasts.push('error', 'Nothing to work with', 'Select text on the page, then retry.');
        return;
      }
      const slot: ChatAttachment = task.kind === 'extract-page'
        ? {
            kind: 'page',
            label: task.pageTitle ?? 'Current tab',
            content,
            url: task.pageUrl,
            addedAt: Date.now(),
          }
        : {
            kind: 'selection',
            label: 'Selected text',
            content,
            url: task.pageUrl,
            addedAt: Date.now(),
          };
      await addContextSlot(slot);
      await postUserTurn(buildTaskUserPrompt(task), get().contextSlots);
    }
  };

  return {
    sessions: [],
    currentSessionId: null,
    messages: [],
    contextSlots: [],
    isGenerating: false,
    abortController: null,
    historyOpen: false,

    async boot() {
      await refreshSessions();
      const sessions = get().sessions;
      const latest = sessions[0];
      if (latest) await get().openSession(latest.id);
      else await get().newSession();
    },

    async newSession() {
      get().abortController?.abort();
      set({
        messages: [],
        contextSlots: [],
        currentSessionId: null,
        isGenerating: false,
        abortController: null,
      });
      await refreshSessions();
    },

    async openSession(id: number) {
      if (get().isGenerating) get().abortController?.abort();
      const chat = await getChat(id);
      if (!chat) return;
      set({
        currentSessionId: chat.id ?? null,
        messages: chat.messages,
        contextSlots: chat.contextSlots ?? [],
      });
      void useOllamaStore.getState().selectModel(chat.model || useSettingsStore.getState().lastModel || '');
      await refreshSessions();
    },

    async deleteSession(id: number) {
      get().abortController?.abort();
      await deleteChat(id);
      if (get().currentSessionId === id) await get().newSession();
      await refreshSessions();
    },

    stop() {
      get().abortController?.abort();
    },

    async sendText(text: string) {
      await postUserTurn(text);
    },

    async regenerateLast() {
      await regenerateOrRetry(false);
    },

    async retryError() {
      await regenerateOrRetry(true);
    },

    addContextSlot,
    removeContextSlot,
    handlePendingTask,
    setHistoryOpen(open: boolean) {
      set({ historyOpen: open });
    },
  };
});