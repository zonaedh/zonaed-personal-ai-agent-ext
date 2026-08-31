import { useCallback, useRef, useState } from 'react';
import { CornerDownLeft, Globe, Loader2, Mic, MicOff, Square } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import { isGeminiModel } from '@/lib/gemini';
import { isCloudModel, parseCloudModel } from '@/lib/openai-compatible';
import { useChatStore } from '@/store/chat-store';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { ContextChips } from '@/components/chat/context-chips';
import { ModelPicker } from '@/components/chat/model-picker';
import { ToolsMenu } from '@/components/tools/tools-menu';
import { cn } from '@/lib/cn';

/**
 * Chat composer: streaming-first composer with page/selection context attach,
 * dynamic model row, voice dictation, and stop/cancel for in-flight generations.
 */
export function Composer() {
  const messages = useChatStore((s) => s.messages);
  const contextSlots = useChatStore((s) => s.contextSlots);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendText = useChatStore((s) => s.sendText);
  const stop = useChatStore((s) => s.stop);
  const addContextSlot = useChatStore((s) => s.addContextSlot);
  const removeContextSlot = useChatStore((s) => s.removeContextSlot);
  const ollamaStatus = useOllamaStore((s) => s.status);
  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);
  const openRouterApiKey = useSettingsStore((s) => s.openRouterApiKey);
  const deepSeekApiKey = useSettingsStore((s) => s.deepSeekApiKey);
  const language = useSettingsStore((s) => s.language);

  const [draft, setDraft] = useState('');
  const [readingPage, setReadingPage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const submit = async () => {
    const text = draft.trim();
    if (!text || isGenerating) return;
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendText(text);
  };

  const attachPage = async () => {
    if (readingPage) return;
    setReadingPage(true);
    try {
      const page = await readActiveTabPage();
      if (!page.ok) {
        useToastStore
          .getState()
          .push(
            'error',
            page.needsActivation ? 'Grant access first' : 'Couldn’t read this page',
            page.needsActivation
              ? 'Click the extension icon (or press Ctrl+Shift+Z), then try again — that grants this tab access.'
              : page.error ?? 'Unknown error.',
          );
        return;
      }
      await addContextSlot({
        kind: 'page',
        label: page.title ?? 'Current tab',
        content: page.text ?? '',
        url: page.url,
        addedAt: Date.now(),
      });
      useToastStore
        .getState()
        .push('success', 'Page attached', `${(page.text ?? '').length.toLocaleString()} chars of readable content added as context.`);
    } finally {
      setReadingPage(false);
    }
  };

  const toggleVoice = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      useToastStore.getState().push('error', 'Voice Not Supported', 'Web Speech API is not supported in this browser window.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      // Prompt for microphone permission if not yet granted
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (micErr) {
          useToastStore.getState().push(
            'info',
            'Allow Microphone Access 🎙️',
            'Opening full tab to grant microphone permission. Click "Allow" on the Chrome prompt!',
          );
          if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            void chrome.tabs.create({
              url: chrome.runtime.getURL('src/options/index.html?tab=general&requestMic=1'),
            });
          }
          return;
        }
      }

      const baseDraft = draft.trim();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        useToastStore
          .getState()
          .push(
            'info',
            '🎙️ Listening...',
            language === 'bn' ? 'বাংলায় কথা বলুন...' : 'Listening... Speak into your microphone.',
          );
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const combined = [baseDraft, finalTranscript || interimTranscript].filter(Boolean).join(' ');
        setDraft(combined);
        if (textareaRef.current) {
          resize(textareaRef.current);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          useToastStore.getState().push('error', 'Voice Error', `Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech init failed:', err);
      setIsListening(false);
      useToastStore.getState().push(
        'error',
        'Voice Recognition Failed',
        err instanceof Error ? err.message : 'Could not start voice recognition.',
      );
    }
  };

  const serverProxyUrl = useSettingsStore((s) => s.serverProxyUrl);
  const pinSessionToken = useSettingsStore((s) => s.pinSessionToken);

  const isAuto = selectedModel === 'auto' || !selectedModel;
  const isGemini = isGeminiModel(selectedModel);
  const isCloud = isCloudModel(selectedModel);

  let hasValidEngine = false;
  if (isAuto) {
    hasValidEngine = Boolean(
      serverProxyUrl ||
      pinSessionToken ||
      groqApiKey ||
      geminiApiKey ||
      openRouterApiKey ||
      deepSeekApiKey ||
      ollamaStatus === 'online',
    );
  } else if (isGemini) {
    hasValidEngine = Boolean(geminiApiKey || serverProxyUrl || pinSessionToken);
  } else if (isCloud) {
    const { provider } = parseCloudModel(selectedModel ?? '');
    hasValidEngine = Boolean(
      serverProxyUrl ||
      pinSessionToken ||
      (provider === 'groq'
        ? groqApiKey
        : provider === 'deepseek'
        ? deepSeekApiKey
        : openRouterApiKey),
    );
  } else {
    hasValidEngine = ollamaStatus === 'online' || Boolean(serverProxyUrl);
  }

  const canSend = hasValidEngine && !isGenerating;
  const placeholder =
    messages.length === 0
      ? isAuto
        ? 'Ask anything… (Auto-routed with zero downtime)'
        : isGemini || isCloud
        ? 'Ask anything… (Enter to send)'
        : 'Ask anything — I run 100% on your machine…'
      : 'Follow up… (Enter to send, Shift+Enter for newline)';

  return (
    <div className="border-t border-border/40 bg-card/50 backdrop-blur-xl px-4 pb-4 pt-2.5">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <ContextChips slots={contextSlots} onRemove={(i) => void removeContextSlot(i)} />

        <div className="rounded-2xl border border-border/80 bg-background/95 shadow-md shadow-black/5 transition-all focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              resize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="max-h-40 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs sm:text-sm"
            disabled={isGenerating}
            aria-label="Message"
          />
          <div className="flex items-center gap-1.5 px-2 pb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs transition-transform hover:scale-105"
              onClick={() => void attachPage()}
              disabled={readingPage || isGenerating}
              title="Attach the current tab’s readable content as context"
            >
              {readingPage ? <Loader2 className="animate-spin" /> : <Globe className="h-3.5 w-3.5 text-indigo-400" />}
              Read page
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 gap-1 px-2 text-xs transition-all hover:scale-105',
                isListening && 'bg-red-500/15 text-red-500 animate-pulse ring-1 ring-red-500/30',
              )}
              onClick={toggleVoice}
              disabled={isGenerating}
              title={isListening ? 'Stop listening' : 'Voice dictation (Speak to prompt)'}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[11px] font-semibold text-red-500">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  <span className="text-[11px]">Voice</span>
                </>
              )}
            </Button>

            <ToolsMenu />
            <div className="flex-1" />
            {isGenerating ? (
              <Button variant="outline" size="sm" className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={stop}>
                <Square className="h-3 w-3 fill-current" /> Stop
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 gap-1 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:scale-105 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:hover:scale-100"
                onClick={() => void submit()}
                disabled={!draft.trim() || !canSend}
                title="Send (Enter)"
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
                Send
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 bg-muted/25 px-2.5 py-1 text-[11px]">
            <ModelPicker />
            {ollamaStatus === 'online' && useOllamaStore.getState().models.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">
                Pull a model in Ollama to get started.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}