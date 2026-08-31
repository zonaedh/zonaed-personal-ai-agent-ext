import { memo, useState } from 'react';
import { AlertTriangle, Bot, Check, Copy, ExternalLink, FileSpreadsheet, RotateCcw, Square, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { copyToClipboard } from '@/lib/util';
import { exportToGoogleDocs } from '@/lib/marketing-plan';
import { exportToGoogleSheets } from '@/lib/sheets-export';
import { saveAsExample } from '@/lib/few-shot-bank';
import { submitNegativeFeedback, FEEDBACK_OPTIONS, type FeedbackType } from '@/lib/feedback-engine';
import { useToastStore } from '@/store/toast-store';
import { useChatStore } from '@/store/chat-store';
import type { ChatMessage } from '@/shared/types';
import { Markdown } from '@/components/markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThinkingBox, parseThinkingContent } from '@/components/chat/thinking-box';

interface MessageItemProps {
  message: ChatMessage;
  isLast?: boolean;
  onRegenerate?: () => void;
  onRetry?: () => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  isLast,
  onRegenerate,
  onRetry,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [savedExample, setSavedExample] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [customFeedback, setCustomFeedback] = useState('');

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-xs sm:text-sm font-medium text-primary-foreground shadow-2xs">
          {message.content}
        </div>
      </div>
    );
  }

  const streaming = message.status === 'streaming';
  const { thinking, isThinkingActive, content: cleanContent } = parseThinkingContent(
    message.content,
    streaming,
  );

  const copyable = cleanContent.trim().length > 0 && !streaming;

  const onCopy = async () => {
    const ok = await copyToClipboard(cleanContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  /** Feature 3: Save as few-shot example when user clicks 👍 */
  const onSaveExample = async () => {
    // Find the preceding user message
    const messages = useChatStore.getState().messages;
    const msgIndex = messages.findIndex((m) => m.id === message.id);
    let userPrompt = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        userPrompt = messages[i]!.content;
        break;
      }
    }
    if (!userPrompt || !cleanContent) return;

    try {
      await saveAsExample(userPrompt, cleanContent);
      setSavedExample(true);
      useToastStore.getState().push('success', '✅ Style Saved', 'This response is saved as a style example for future use.');
      setTimeout(() => setSavedExample(false), 3000);
    } catch (err) {
      console.warn('Failed to save example:', err);
    }
  };

  /** Feature 4: Submit negative feedback */
  const onSubmitFeedback = async (type: FeedbackType, custom?: string) => {
    try {
      const result = await submitNegativeFeedback(type, custom);
      if (result) {
        useToastStore.getState().push('info', '📝 Feedback Saved', 'I\'ll improve based on your feedback.');
      }
      setShowFeedback(false);
      setCustomFeedback('');
    } catch (err) {
      console.warn('Failed to save feedback:', err);
    }
  };

  return (
    <div className="group flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-2xs">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        {thinking ? (
          <ThinkingBox thinking={thinking} isThinkingActive={isThinkingActive} />
        ) : null}

        {cleanContent ? (
          <Markdown content={cleanContent} streaming={streaming && !isThinkingActive} />
        ) : streaming && !thinking ? (
          <div className="space-y-1.5 py-1">
            <Skeleton className="h-3.5 w-11/12 animate-shimmer" />
            <Skeleton className="h-3.5 w-3/5 animate-shimmer" />
          </div>
        ) : null}

        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 flex-wrap">
          {copyable ? (
            <>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={onCopy}>
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10"
                onClick={async () => {
                  const res = await exportToGoogleDocs(cleanContent);
                  useToastStore
                    .getState()
                    .push(
                      'success',
                      'Copied to Clipboard!',
                      res.openedNew
                        ? 'Google Doc opened. Press Ctrl+V to paste.'
                        : 'Switched to open Google Doc. Press Ctrl+V to paste.',
                    );
                }}
                title="Copy and open Google Doc"
              >
                <ExternalLink className="h-3 w-3 mr-1" /> Google Doc
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={async () => {
                  const res = await exportToGoogleSheets(cleanContent);
                  useToastStore
                    .getState()
                    .push(
                      'success',
                      'TSV Copied!',
                      res.openedNew
                        ? 'Google Sheet opened. Press Ctrl+V to paste cells.'
                        : 'Switched to open Google Sheet. Press Ctrl+V to paste cells.',
                    );
                }}
                title="Copy TSV table and open Google Sheets"
              >
                <FileSpreadsheet className="h-3 w-3 mr-1" /> Google Sheet
              </Button>

              {/* Feature 3: 👍 Save as style example */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-1.5 text-xs',
                  savedExample
                    ? 'text-emerald-500'
                    : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10',
                )}
                onClick={onSaveExample}
                title="Save this response as a style example"
              >
                <ThumbsUp className="h-3 w-3" />
                {savedExample ? 'Saved!' : ''}
              </Button>

              {/* Feature 4: 👎 Negative feedback */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-1.5 text-xs',
                  showFeedback
                    ? 'text-red-500'
                    : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
                )}
                onClick={() => setShowFeedback(!showFeedback)}
                title="Give feedback on this response"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </>
          ) : null}
          {isLast && message.status !== 'streaming' && onRegenerate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={onRegenerate}
              title="Regenerate response"
            >
              <RotateCcw className="h-3 w-3" /> Regenerate
            </Button>
          ) : null}
          {streaming ? (
            <span className="flex items-center gap-1 px-1.5 text-xs text-muted-foreground">
              <Square className="h-3 w-3" /> Generating…
            </span>
          ) : null}
        </div>

        {/* Feature 4: Inline feedback panel */}
        {showFeedback ? (
          <div className="mt-2 rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground/80">What went wrong?</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setShowFeedback(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FEEDBACK_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => onSubmitFeedback(opt.type)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Custom feedback..."
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customFeedback.trim()) {
                    void onSubmitFeedback('custom', customFeedback);
                  }
                }}
                className="flex-1 rounded-md border border-border/50 bg-background/50 px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={!customFeedback.trim()}
                onClick={() => onSubmitFeedback('custom', customFeedback)}
              >
                Submit
              </Button>
            </div>
          </div>
        ) : null}

        {message.status === 'error' && message.error ? (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-destructive">Generation failed</p>
              <p className="mt-0.5 text-muted-foreground">{message.error}</p>
              {onRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={onRetry}
                >
                  <RotateCcw className="h-3 w-3" /> Retry
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {message.status === 'stopped' ? (
          <Badge variant="muted" className="mt-1.5">
            Stopped
          </Badge>
        ) : null}
      </div>
    </div>
  );
});

export function MessageGap({ className }: { className?: string }) {
  return <div className={cn('my-1', className)} />;
}