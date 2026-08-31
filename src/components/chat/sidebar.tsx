import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  Shield,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  TrendingUp,
  Youtube,
  FileCheck,
  Table2,
  Eye,
  Bot,
  Lock,
} from 'lucide-react';
import { searchChats } from '@/db/db';
import { openOptionsPage } from '@/lib/chrome';
import { formatDateTime } from '@/lib/util';
import type { ChatSessionMeta } from '@/shared/types';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import { useToolsStore, type ToolId } from '@/store/tools-store';
import { cn } from '@/lib/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const sessions = useChatStore((s) => s.sessions);
  const currentId = useChatStore((s) => s.currentSessionId);
  const openSession = useChatStore((s) => s.openSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const newSession = useChatStore((s) => s.newSession);
  const openTool = useToolsStore((s) => s.open);
  const lock = useSettingsStore((s) => s.lock);
  const openSettings = useSettingsStore((s) => s.openSettings);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatSessionMeta[] | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      void searchChats(query).then((rows) => setResults(rows));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, sessions]);

  const list = results ?? sessions;

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full w-14 flex-col items-center justify-between border-r border-border/60 bg-card/70 py-3.5 backdrop-blur-xl transition-all duration-300">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Expand Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => void newSession()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-transform hover:scale-105"
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => openSettings()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => lock()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Lock Workspace"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 md:w-72 shrink-0 flex-col justify-between border-r border-border/60 bg-card/80 backdrop-blur-2xl transition-all duration-300">
      {/* Top Header & New Chat */}
      <div className="flex flex-col gap-3 p-3.5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-400 text-xs font-black text-white shadow-md shadow-indigo-500/30 ring-1 ring-white/20">
              Z
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-foreground font-sans">
                Zonaed AI
              </span>
              <span className="text-[10px] font-medium text-muted-foreground -mt-0.5">
                Personal Autonomous Agent
              </span>
            </div>
          </div>

          <button
            onClick={onToggleCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={() => void newSession()}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:opacity-95 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
            Ctrl+K
          </span>
        </button>

        {/* Search Chats Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-background/60 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Middle Scrollable Section: Tools & Chat History */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {/* Quick Tools & Playbooks */}
        <div className="space-y-1">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Growth &amp; AI Playbooks
          </span>
          <div className="grid grid-cols-1 gap-0.5 pt-0.5">
            {[
              { id: 'marketing', label: '360° Marketing Plan', icon: TrendingUp, color: 'text-indigo-500' },
              { id: 'whatsapp', label: 'WhatsApp Lead CRM', icon: MessageSquare, color: 'text-emerald-500' },
              { id: 'youtube', label: 'YouTube Content Studio', icon: Youtube, color: 'text-rose-500' },
              { id: 'audit', label: 'Website Growth Audit', icon: FileCheck, color: 'text-emerald-500' },
              { id: 'scrape', label: 'Google Sheets Extractor', icon: Table2, color: 'text-cyan-500' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => openTool(t.id as any)}
                className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              >
                <t.icon className={cn('h-3.5 w-3.5 shrink-0', t.color)} />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat History List */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Recent Chats
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground/60">
              {list.length}
            </span>
          </div>

          {list.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {query ? 'No matching conversations' : 'No chats saved yet'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {list.map((s) => {
                const isActive = s.id === currentId;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer',
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold ring-1 ring-indigo-500/30'
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                    )}
                    onClick={() => void openSession(s.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-6">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{s.title || 'Untitled conversation'}</span>
                        <span className="text-[9px] text-muted-foreground/60 truncate font-normal">
                          {formatDateTime(s.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteSession(s.id);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer User Profile & System Status */}
      <div className="border-t border-border/40 p-3 bg-background/40 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 text-xs font-bold text-white shadow-sm">
              Z
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">Zonaed</span>
              <span className="text-[9px] font-medium text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openSettings()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Settings &amp; Dashboard"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => lock()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Lock Agent"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
