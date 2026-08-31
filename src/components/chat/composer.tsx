import { useCallback, useRef, useState } from 'react';
import {
  Loader2,
  Mic,
  MicOff,
  Plus,
  RotateCw,
  Send,
  Square,
} from 'lucide-react';
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
import { ToolsMenu } from '@/components/tools/tools-menu';
import { cn } from '@/lib/cn';

const SUGGESTION_PILLS = [
  { id: '1', label: '📝 Help me write a high-converting cold pitch', prompt: 'Help me write a high-converting cold outreach email and LinkedIn pitch with zero fluff.' },
  { id: '2', label: '📊 Extract data to Google Sheets', prompt: 'Help me extract structured data and leads from the current webpage into Google Sheets.' },
  { id: '3', label: '📈 360° Digital marketing plan', prompt: 'Create a full 360° digital marketing plan with SMM, SEO, and paid ad strategies.' },
  { id: '4', label: '🎬 YouTube to viral LinkedIn post', prompt: 'Turn this YouTube video into a viral hook-driven LinkedIn post and carousel outline.' },
];

/**
 * Voxle-inspired Chat Composer: Floating rounded card with bottom utility icons,
 * vibrant blue Talk/Send pill button, and prompt suggestion chips below.
 */
export function Composer() {
  const messages = useChatStore((s) => s.messages);
  const contextSlots = useChatStore((s) => s.contextSlots);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const sendText = useChatStore((s) => s.sendText);
  const stop = useChatStore((s) => s.stop);
  const newSession = useChatStore((s) => s.newSession);
  const addContextSlot = useChatStore((s) => s.addContextSlot);
  const removeContextSlot = useChatStore((s) => s.removeContextSlot);
  const ollamaStatus = useOllamaStore((s) => s.status);
  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);
  const openRouterApiKey = useSettingsStore((s) => s.openRouterApiKey);
  const deepSeekApiKey = useSettingsStore((s) => s.deepSeekApiKey);
  const serverProxyUrl = useSettingsStore((s) => s.serverProxyUrl);
  const pinSessionToken = useSettingsStore((s) => s.pinSessionToken);
  const language = useSettingsStore((s) => s.language);

  const [draft, setDraft] = useState('');
  const [readingPage, setReadingPage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  const submit = async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
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
              ? 'Click the extension icon (or press Ctrl+Shift+Z), then try again.'
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
        .push('success', 'Page attached', `${(page.text ?? '').length.toLocaleString()} chars of readable content added.`);
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
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';

      const baseDraft = draft;

      recognition.onstart = () => {
        setIsListening(true);
        useToastStore
          .getState()
          .push('info', '🎙️ Listening...', 'Speak into your microphone.');
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
        if (textareaRef.current) resize(textareaRef.current);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          useToastStore.getState().push('error', 'Voice Error', `Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      useToastStore.getState().push(
        'error',
        'Voice Recognition Failed',
        err instanceof Error ? err.message : 'Could not start voice recognition.',
      );
    }
  };

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

  return (
    <div className="shrink-0 z-20 border-t border-border/40 bg-background/95 backdrop-blur-md px-3 sm:px-4 pt-2 select-none safe-pb">
      <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:gap-3">
        <ContextChips slots={contextSlots} onRemove={(i) => void removeContextSlot(i)} />

        {/* Voxle-style Floating Card Container */}
        <div className="relative rounded-2xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-2xs transition-all focus-within:border-primary/60 focus-within:shadow-md focus-within:shadow-black/5">
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
            placeholder="How can I help you today?"
            rows={1}
            className="max-h-44 border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/70 font-sans resize-none"
            disabled={isGenerating}
            aria-label="Message"
          />

          {/* Bottom Action Controls Bar */}
          <div className="flex items-center justify-between pt-1.5 sm:pt-2">
            {/* Left Action Buttons (+ Attach, Tools, Reset) */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                onClick={() => void attachPage()}
                disabled={readingPage || isGenerating}
                title="Attach active page context"
              >
                {readingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>

              <ToolsMenu />

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                onClick={() => void newSession()}
                disabled={isGenerating}
                title="Reset / New Chat"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Right Action Buttons (Voice dictation + Voxle-style Blue Talk/Send Pill) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95',
                  isListening && 'bg-red-500/15 text-red-500 animate-pulse ring-1 ring-red-500/30',
                )}
                onClick={toggleVoice}
                disabled={isGenerating}
                title={isListening ? 'Stop listening' : 'Voice Dictation'}
              >
                {isListening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
              </Button>

              {isGenerating ? (
                <button
                  onClick={stop}
                  className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 sm:px-3.5 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20 active:scale-95"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={() => void submit()}
                  disabled={!draft.trim() || !canSend}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 sm:px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs transition-all hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                  title="Send message (Enter)"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Talk</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Voxle-style Prompt Suggestion Pills (Shown when conversation is fresh) */}
        {messages.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 pt-0.5">
            {SUGGESTION_PILLS.map((p) => (
              <button
                key={p.id}
                onClick={() => void submit(p.prompt)}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 sm:px-3.5 py-2 text-left text-xs font-medium text-foreground/80 shadow-2xs transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground active:scale-[0.99]"
              >
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}