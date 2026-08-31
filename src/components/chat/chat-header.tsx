import { useState } from 'react';
import {
  BookOpen,
  History,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  PanelLeft,
} from 'lucide-react';
import { applyTheme, type ThemeMode } from '@/lib/theme';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
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
  const openSettings = useSettingsStore((s) => s.openSettings);

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md px-4 md:px-6 select-none">
      {/* Left section: Voxle-style Brand Emblem + Vertical Divider + Model Selector Pill */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Toggle Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Voxle-style clean star icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card text-primary shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 fill-primary/20 text-primary" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-foreground font-sans">
            Zonaed
          </span>
          <span className="h-4 w-px bg-border/80 hidden sm:inline-block mx-0.5" />
        </div>

        {/* Model Switcher Pill */}
        <div className="hidden sm:block">
          <ModelPicker />
        </div>
      </div>

      {/* Right section: Vibrant Blue + New chat pill, Search chat, Library, Theme & Settings */}
      <div className="flex items-center gap-2">
        {/* Voxle-style bright blue + New Chat pill */}
        <button
          onClick={() => void newSession()}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs transition-all hover:opacity-95 hover:shadow-sm active:scale-95"
          title="New Chat (Ctrl+K)"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>New chat</span>
        </button>

        {/* Search chat text button */}
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="hidden md:flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Search conversations"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search chat</span>
        </button>

        {/* Library / History text button */}
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className={cn(
            'hidden lg:flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground',
            historyOpen ? 'bg-accent text-foreground' : 'text-muted-foreground',
          )}
          title="Chat Library & History"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Library</span>
        </button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void toggleTheme()}
          className="h-8 w-8 rounded-full transition-transform hover:scale-105"
          title="Toggle Dark / Light"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-primary" />}
        </Button>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openSettings()}
          className="h-8 w-8 rounded-full transition-transform hover:scale-105 text-muted-foreground hover:text-foreground"
          title="Settings & Dashboard"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}