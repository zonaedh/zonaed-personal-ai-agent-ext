import { useState } from 'react';
import { History, Moon, Plus, Settings, Sun } from 'lucide-react';
import { openOptionsPage } from '@/lib/chrome';
import { applyTheme, type ThemeMode } from '@/lib/theme';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import { ConnectionPill } from '@/components/chat/connection-pill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Side-panel header: Brand emblem, connection status pill,
 * session actions (history, new chat, theme, options dashboard).
 */
export function ChatHeader() {
  const historyOpen = useChatStore((s) => s.historyOpen);
  const setHistoryOpen = useChatStore((s) => s.setHistoryOpen);
  const newSession = useChatStore((s) => s.newSession);
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);

  const [themeBusy, setThemeBusy] = useState(false);
  const toggleTheme = async () => {
    if (themeBusy) return;
    setThemeBusy(true);
    const resolved: ThemeMode = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark')
      : theme === 'dark'
        ? 'light'
        : 'dark';
    await update({ theme: resolved });
    applyTheme(resolved);
    setThemeBusy(false);
  };

  return (
    <header className="flex items-center gap-2 border-b bg-card/60 backdrop-blur-md px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 text-xs font-black text-white shadow-sm shadow-indigo-500/20 ring-1 ring-white/20">
          Z
        </div>
        <div className="flex flex-col">
          <h1 className="text-xs font-bold tracking-tight gradient-text">
            Zonaed AI
          </h1>
          <span className="text-[9px] font-medium text-muted-foreground -mt-0.5">
            Personal Agent
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <ConnectionPill />

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHistoryOpen(!historyOpen)}
          className={cn("h-7 w-7 transition-transform hover:scale-105", historyOpen && "bg-accent text-accent-foreground")}
          title="Chat history"
          aria-label="Toggle chat history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void newSession()}
          className="h-7 w-7 transition-transform hover:scale-105"
          title="New chat"
          aria-label="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void toggleTheme()}
          className="h-7 w-7 transition-transform hover:scale-105"
          title="Toggle dark / light"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void openOptionsPage()}
          className="h-7 w-7 transition-transform hover:scale-105 text-muted-foreground hover:text-foreground"
          title="Agent Dashboard & Settings"
          aria-label="Agent Dashboard & Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}