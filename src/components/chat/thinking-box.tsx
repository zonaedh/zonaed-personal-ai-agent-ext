import { useState, useEffect } from 'react';
import { Brain, ChevronDown, Sparkles, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { copyToClipboard } from '@/lib/util';

export interface ParsedMessageContent {
  thinking: string | null;
  isThinkingActive: boolean;
  content: string;
}

/**
 * Parses internal reasoning tokens (<think>...</think> or <thought>...</thought>)
 * separating internal monologue from the actual user-facing content.
 */
export function parseThinkingContent(raw: string, isStreaming = false): ParsedMessageContent {
  if (!raw) return { thinking: null, isThinkingActive: false, content: '' };

  // 1. Check for standard <think>...</think> tags
  const thinkOpenIdx = raw.indexOf('<think>');
  if (thinkOpenIdx !== -1) {
    const afterOpen = raw.slice(thinkOpenIdx + 7);
    const thinkCloseIdx = afterOpen.indexOf('</think>');
    if (thinkCloseIdx !== -1) {
      const thinking = afterOpen.slice(0, thinkCloseIdx).trim();
      const content = (raw.slice(0, thinkOpenIdx) + afterOpen.slice(thinkCloseIdx + 8)).trim();
      return { thinking, isThinkingActive: false, content };
    } else {
      // Still actively thinking in stream
      return {
        thinking: afterOpen.trim(),
        isThinkingActive: isStreaming,
        content: raw.slice(0, thinkOpenIdx).trim(),
      };
    }
  }

  // 2. Check for <thought>...</thought> tags
  const thoughtOpenIdx = raw.indexOf('<thought>');
  if (thoughtOpenIdx !== -1) {
    const afterOpen = raw.slice(thoughtOpenIdx + 9);
    const thoughtCloseIdx = afterOpen.indexOf('</thought>');
    if (thoughtCloseIdx !== -1) {
      const thinking = afterOpen.slice(0, thoughtCloseIdx).trim();
      const content = (raw.slice(0, thoughtOpenIdx) + afterOpen.slice(thoughtCloseIdx + 10)).trim();
      return { thinking, isThinkingActive: false, content };
    } else {
      return {
        thinking: afterOpen.trim(),
        isThinkingActive: isStreaming,
        content: raw.slice(0, thoughtOpenIdx).trim(),
      };
    }
  }

  return { thinking: null, isThinkingActive: false, content: raw };
}

interface ThinkingBoxProps {
  thinking: string;
  isThinkingActive: boolean;
  className?: string;
}

/**
 * Premium collapsible Thinking/Reasoning block for AI models like DeepSeek R1 & Qwen.
 */
export function ThinkingBox({ thinking, isThinkingActive, className }: ThinkingBoxProps) {
  // Keep open while model is actively thinking; collapse once final content starts streaming
  const [isOpen, setIsOpen] = useState(isThinkingActive);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isThinkingActive) {
      setIsOpen(true);
    }
  }, [isThinkingActive]);

  const onCopyThinking = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(thinking);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className={cn(
        'group/think rounded-xl border border-indigo-500/20 bg-indigo-950/20 dark:bg-indigo-950/30 backdrop-blur-sm overflow-hidden mb-3 transition-all',
        isThinkingActive && 'border-indigo-500/40 ring-1 ring-indigo-500/20',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-400',
              isThinkingActive && 'animate-pulse',
            )}
          >
            <Brain className="h-3 w-3" />
          </div>
          <span className="font-semibold tracking-wide text-xs">
            {isThinkingActive ? (
              <span className="flex items-center gap-1.5 text-indigo-400">
                Thinking process...
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
              </span>
            ) : (
              <span className="text-muted-foreground group-hover/think:text-indigo-300 transition-colors">
                Thought Process
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {thinking && !isThinkingActive && (
            <button
              type="button"
              onClick={onCopyThinking}
              title="Copy reasoning logs"
              className="opacity-0 group-hover/think:opacity-100 transition-opacity p-1 hover:bg-indigo-500/20 rounded text-muted-foreground hover:text-indigo-300"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-indigo-500/15 bg-black/20 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground/90 font-mono whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-indigo-500/30">
          {thinking || 'Analyzing user prompt and context...'}
        </div>
      )}
    </div>
  );
}
