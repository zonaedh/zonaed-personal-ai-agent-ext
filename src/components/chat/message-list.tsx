import { useEffect, useRef, useState } from 'react';
import { MessageGap, MessageItem } from '@/components/chat/message-item';
import { EmptyState } from '@/components/chat/empty-state';
import type { ChatMessage } from '@/shared/types';

/**
 * Scrollable message pane. Auto-sticks to bottom while streaming; the user can
 * scroll up to inspect earlier turns without being yanked back down.
 */
export function MessageList({
  messages,
  isGenerating,
  onRegenerate,
  onRetry,
  onSuggestion,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
  onSuggestion: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStick(distance < 48);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick) el.scrollTop = el.scrollHeight;
  }, [messages, stick]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="scroll-area flex-1 overflow-y-auto">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  const lastIndex = messages.length - 1;

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="scroll-area flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <MessageItem
              message={msg}
              isLast={i === lastIndex}
              onRegenerate={i === lastIndex ? onRegenerate : undefined}
              onRetry={i === lastIndex ? onRetry : undefined}
            />
            {i < lastIndex ? <MessageGap /> : null}
          </div>
        ))}
        {isGenerating ? <div className="h-1" /> : null}
      </div>
    </div>
  );
}