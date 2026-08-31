import { useState } from 'react';
import { History, Moon, Plus, Settings, Sun, PanelLeft, Sparkles } from 'lucide-react';
import { openOptionsPage } from '@/lib/chrome';
import { applyTheme, type ThemeMode } from '@/lib/theme';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import { ConnectionPill } from '@/components/chat/connection-pill';
import { ModelPicker } from '@/components/chat/model-picker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface ChatHeaderProps {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatHeader({ sidebarCollapsed, onToggleSidebar }: ChatHeaderProps) {
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
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-card/70 backdrop-blur-xl px-3.5 shadow-sm">
      {/* Left section: Sidebar toggle & Model Picker */}
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Toggle Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* Model Picker in header */}
        <div className="hidden sm:block">
          <ModelPicker />
        </div>
      </div>

      {/* Right section: Connection Status Pill, Theme Toggle, New Chat, Settings */}
      <div className="flex items-center gap-1.5">
        <ConnectionPill />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void newSession()}
          className="h-8 w-8 transition-transform hover:scale-105"
          title="New Chat (Ctrl+K)"
          aria-label="New chat"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void toggleTheme()}
          className="h-8 w-8 transition-transform hover:scale-105"
          title="Toggle Dark / Light"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void openOptionsPage()}
          className="h-8 w-8 transition-transform hover:scale-105 text-muted-foreground hover:text-foreground"
          title="Agent Dashboard & Settings"
          aria-label="Agent Dashboard & Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}