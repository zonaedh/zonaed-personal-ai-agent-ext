import { useEffect, useState } from 'react';
import { MessageSquareText, Search, Trash2, X } from 'lucide-react';
import { formatDateTime } from '@/lib/util';
import { searchChats } from '@/db/db';
import type { ChatSessionMeta } from '@/shared/types';
import { useChatStore } from '@/store/chat-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * History drawer with full-text search over saved chats + saved prompts
 * (spec: "Save + full-text search chat history and prompts in Dexie").
 */
export function HistoryDrawer() {
  const open = useChatStore((s) => s.historyOpen);
  const setOpen = useChatStore((s) => s.setHistoryOpen);
  const sessions = useChatStore((s) => s.sessions);
  const currentId = useChatStore((s) => s.currentSessionId);
  const openSession = useChatStore((s) => s.openSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const newSession = useChatStore((s) => s.newSession);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatSessionMeta[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults(null);
    setLoading(true);
    void searchChats('').then((rows) => {
      setResults(rows);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchChats(query).then((rows) => {
        setResults(rows);
        setLoading(false);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open, sessions]);

  const list = results ?? sessions;

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 flex w-[300px] flex-col border-l bg-card shadow-xl transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="flex-1 text-sm font-semibold">History</h2>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void newSession()}>
          New chat
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close history">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="pl-8"
          />
        </div>
      </div>
      <div className="scroll-area flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {loading && list.length === 0 ? (
          <div className="space-y-1.5 px-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {query ? 'No matches.' : 'No chats yet.'}
          </p>
        ) : (
          list.map((s) => (
            <div
              key={s.id}
              className={`group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60 ${
                s.id === currentId ? 'bg-accent/60' : ''
              }`}
              onClick={() => void openSession(s.id)}
            >
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{s.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.preview} · {formatDateTime(s.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteSession(s.id);
                }}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                aria-label={`Delete chat ${s.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}