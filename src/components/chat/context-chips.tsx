import { FileText, Highlighter, Images, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChatAttachment } from '@/shared/types';
import { Badge } from '@/components/ui/badge';

const KIND_ICON = {
  page: FileText,
  selection: Highlighter,
  tab: FileText,
  image: Images,
} as const;

const KIND_LABEL = {
  page: 'Page',
  selection: 'Selection',
  tab: 'Tab',
  image: 'Image',
} as const;

/**
 * Renders the attached context slot chips ("Page · Current tab" etc.). These
 * are explicitly attached by the user — nothing is ever silently added.
 */
export function ContextChips({
  slots,
  onRemove,
  className,
}: {
  slots: ChatAttachment[];
  onRemove?: (index: number) => void;
  className?: string;
}) {
  if (slots.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {slots.map((slot, i) => {
        const Icon = KIND_ICON[slot.kind] ?? FileText;
        return (
          <Badge key={`${slot.kind}-${slot.addedAt}-${i}`} variant="secondary" className="gap-1 pr-1.5">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="max-w-[140px] truncate">
              {KIND_LABEL[slot.kind]}: {slot.label}
            </span>
            {onRemove ? (
              <button
                onClick={() => onRemove(i)}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label={`Remove context: ${slot.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </Badge>
        );
      })}
    </div>
  );
}