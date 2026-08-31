import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/store/toast-store';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const COLORS = {
  info: 'text-sky-500',
  success: 'text-emerald-500',
  error: 'text-red-500',
} as const;

/**
 * Renders the toast stack (fixed top-right). Each store changes to the toast
 * store auto-dismiss after a few seconds; the close button is manual.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-72 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto animate-fade-in-up rounded-lg border bg-popover p-3 shadow-lg',
              'data-[slide=in]:slide-in-from-right',
            )}
            data-slide="in"
          >
            <div className="flex items-start gap-2">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', COLORS[toast.kind])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}