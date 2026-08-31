import { useEffect } from 'react';
import { readActiveTabPage } from '@/lib/chrome';
import { pendingTaskStorage } from '@/lib/storage';
import { isGeminiModel } from '@/lib/gemini';
import { isCloudModel } from '@/lib/openai-compatible';
import type { ContextTask } from '@/shared/types';
import { useChatStore } from '@/store/chat-store';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';
import { ChatHeader } from '@/components/chat/chat-header';
import { Composer } from '@/components/chat/composer';
import { HistoryDrawer } from '@/components/chat/history-drawer';
import { MessageList } from '@/components/chat/message-list';
import { OllamaOffline } from '@/components/chat/ollama-offline';
import { ToolDialogs } from '@/components/tools';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';

import { PinGate } from '@/components/auth/pin-gate';

/**
 * The primary UI surface (chrome.sidePanel).
 * Boot sequence: settings -> Ollama status/models -> chat (history or pending
 * task) -> consume any queued popup/context-menu task.
 */
export function SidePanelApp() {
  const settingsReady = useSettingsStore((s) => s.ready);
  const isLocked = useSettingsStore((s) => s.isLocked);
  const pinLockEnabled = useSettingsStore((s) => s.pinLockEnabled);
  const ollamaStatus = useOllamaStore((s) => s.status);
  const messages = useChatStore((s) => s.messages);
  const isGenerating = useChatStore((s) => s.isGenerating);

  useEffect(() => {
    const boot = async (): Promise<void> => {
      await useSettingsStore.getState().load();
      void useOllamaStore.getState().refresh(true);
      
      // Check if a popup or context-menu task was queued
      const hasTask = await consumePendingTask();
      if (!hasTask) {
        await useChatStore.getState().boot();
      }
    };
    void boot();
  }, []);

  useEffect(() => {
    // Live path for tasks queued while the panel is already open.
    const listener = (msg: { type?: string }): void => {
      if (msg?.type === 'TASK_QUEUED') void consumePendingTask();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    const unsub = useOllamaStore.subscribe((state, prev) => {
      if (state.status === 'offline' && prev.status === 'checking') {
        useToastStore
          .getState()
          .push('info', 'Ollama isn’t running', 'Start the Ollama app and hit “Retry connection”.');
      }
    });
    return unsub;
  }, []);

  if (!settingsReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (isLocked && pinLockEnabled) {
    return <PinGate onUnlocked={() => useSettingsStore.getState().unlock()} />;
  }

  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);
  const openRouterApiKey = useSettingsStore((s) => s.openRouterApiKey);
  const deepSeekApiKey = useSettingsStore((s) => s.deepSeekApiKey);

  const isCloudActive =
    isGeminiModel(selectedModel) ||
    isCloudModel(selectedModel) ||
    Boolean(geminiApiKey) ||
    Boolean(groqApiKey) ||
    Boolean(openRouterApiKey) ||
    Boolean(deepSeekApiKey);

  return (
    <div className="flex h-full flex-col">
      <ChatHeader />
      {ollamaStatus === 'offline' && !isCloudActive ? (
        <OllamaOffline />
      ) : (
        <>
          <MessageList
            messages={messages}
            isGenerating={isGenerating}
            onRegenerate={() => void useChatStore.getState().regenerateLast()}
            onRetry={() => void useChatStore.getState().retryError()}
            onSuggestion={handleSuggestion}
          />
          <Composer />
        </>
      )}
      <HistoryDrawer />
      <ToolDialogs />
      <Toaster />
    </div>
  );
}

let isConsumingTask = false;

async function consumePendingTask(): Promise<boolean> {
  if (isConsumingTask) return false;
  isConsumingTask = true;
  try {
    const task = await pendingTaskStorage.get<ContextTask>();
    if (!task) return false;
    await pendingTaskStorage.remove();
    await useChatStore.getState().handlePendingTask(task);
    return true;
  } catch (err) {
    console.warn('Failed to consume pending task:', err);
    return false;
  } finally {
    isConsumingTask = false;
  }
}

async function handleSuggestion(text: string): Promise<void> {
  const chat = useChatStore.getState();
  if (!text) {
    // "Summarize this page" — attach the page, then ask.
    await chat.newSession();
    const ok = await readPageForSuggestion();
    if (!ok) return;
    await chat.sendText('Summarize the page I attached. Capture the key points and main takeaways.');
    return;
  }
  await chat.newSession();
  await chat.sendText(text);
}

/** Attach the current tab's readable content as context (suggestion flow). */
async function readPageForSuggestion(): Promise<boolean> {
  const page = await readActiveTabPage();
  if (!page.ok) {
    useToastStore
      .getState()
      .push('error', 'Couldn’t read this page', page.needsActivation
        ? 'Click the extension icon first to grant this tab access, then try again.'
        : page.error ?? 'Unknown error.');
    return false;
  }
  void useChatStore.getState().addContextSlot({
    kind: 'page',
    label: page.title ?? 'Current tab',
    content: page.text ?? '',
    url: page.url,
    addedAt: Date.now(),
  });
  return true;
}