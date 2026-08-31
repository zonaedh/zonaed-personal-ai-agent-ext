import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronUp,
  ClipboardList,
  Eye,
  FileCheck,
  FileSearch,
  Images,
  MessageSquare,
  ScanText,
  Send,
  Sparkles,
  Table2,
  TrendingUp,
  Wand2,
  Wrench,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { useToolsStore, type ToolId } from '@/store/tools-store';
import { cn } from '@/lib/cn';

interface ToolItem {
  id: Exclude<ToolId, null>;
  label: string;
  hint: string;
  icon: LucideIcon;
  badge?: string;
}

interface ToolGroup {
  name: string;
  items: ToolItem[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    name: 'Growth & Client Marketing',
    items: [
      { id: 'youtube', label: 'YouTube Content Studio', hint: '1-click transcript to LinkedIn, Threads & Carousels', icon: Youtube, badge: 'Viral' },
      { id: 'whatsapp', label: 'WhatsApp Lead CRM', hint: 'Extract all numbers & safe follow-up queue', icon: MessageSquare, badge: 'Hot' },
      { id: 'marketing', label: 'Marketing Plan', hint: 'Full-site research, SMM & ads strategy', icon: TrendingUp, badge: 'Popular' },
      { id: 'audit', label: 'Client Audit & Proposal', hint: '1-click growth audit & proposal doc', icon: FileCheck, badge: 'New' },
      { id: 'spy', label: 'Competitor Spy', hint: 'Deconstruct competitor offers & hooks', icon: Eye, badge: 'New' },
      { id: 'outreach', label: 'Cold Outreach Pitcher', hint: 'Personalized LinkedIn & cold emails', icon: Send, badge: 'New' },
      { id: 'social', label: 'Social Post Writer', hint: 'LinkedIn / X / Facebook viral drafts', icon: Wand2 },
    ],
  },
  {
    name: 'Browser AI & Automation',
    items: [
      { id: 'tabs', label: 'Attach Open Tabs', hint: 'Add open browser tabs as chat context', icon: ClipboardList },
      { id: 'ocr', label: 'Screenshot OCR', hint: 'Extract text from the visible tab', icon: ScanText },
      { id: 'scrape', label: 'Scrape Data', hint: 'Extract links, tables, emails & products', icon: Table2 },
      { id: 'fill', label: 'Fill Form', hint: 'Smart autofill from saved profile', icon: FileSearch },
      { id: 'automate', label: 'Run Automation', hint: 'AI action plan you preview & confirm', icon: Bot },
      { id: 'recipes', label: 'Automation Recipes', hint: 'Saved replayable action plans', icon: Images },
    ],
  },
];

/**
 * Compact, categorized Tools dropdown with beautiful icon badges,
 * scroll constraints, and clean group separation.
 */
export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const openTool = useToolsStore((s) => s.open);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all',
          open
            ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-500/30'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        aria-label="Tools"
        title="Explore all marketing & automation tools"
      >
        <Wrench className="h-3.5 w-3.5" />
        <span>Tools</span>
        <ChevronUp className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-9 left-0 z-50 w-72 max-h-[min(380px,calc(100vh-130px))] overflow-y-auto rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl p-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="px-2 py-1.5 mb-1 border-b border-border/50 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" /> Zonaed AI Tools
              </span>
              <span className="text-[10px] text-muted-foreground">Select a tool</span>
            </div>

            <div className="flex flex-col gap-2">
              {TOOL_GROUPS.map((group) => (
                <div key={group.name} className="flex flex-col gap-0.5">
                  <span className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    {group.name}
                  </span>

                  {group.items.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setOpen(false);
                          openTool(t.id);
                        }}
                        className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/70"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground truncate">{t.label}</span>
                            {t.badge ? (
                              <span className={cn(
                                'text-[9px] font-bold px-1 py-0.2 rounded leading-tight',
                                t.badge === 'New' ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
                              )}>
                                {t.badge}
                              </span>
                            ) : null}
                          </div>
                          <span className="block text-[10px] text-muted-foreground truncate">{t.hint}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}