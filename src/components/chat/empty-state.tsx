import { useState } from 'react';
import {
  Code2,
  FileCheck,
  FileText,
  MessageSquare,
  PenTool,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  Wand2,
  Youtube,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useToolsStore, type ToolId } from '@/store/tools-store';
import { AnimatedLogo } from '@/components/ui/animated-logo';
import { cn } from '@/lib/cn';

interface CapabilityCard {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  desc: string;
  toolId?: Exclude<ToolId, null>;
  prompt?: string;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    id: 'writing',
    icon: PenTool,
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Writing',
    desc: 'Your expert AI assistant for Writing.',
    toolId: 'social',
  },
  {
    id: 'programming',
    icon: Code2,
    iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Programming',
    desc: 'Your expert AI assistant for Programming & Automation.',
    toolId: 'automate',
  },
  {
    id: 'growth',
    icon: TrendingUp,
    iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    iconColor: 'text-purple-600 dark:text-purple-400',
    label: 'Growth & Ads',
    desc: 'Your expert AI assistant for Marketing & Strategy.',
    toolId: 'marketing',
  },
  {
    id: 'whatsapp',
    icon: MessageSquare,
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Lead CRM',
    desc: 'Your expert AI assistant for WhatsApp & CRM.',
    toolId: 'whatsapp',
  },
  {
    id: 'research',
    icon: Search,
    iconBg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    label: 'Research',
    desc: 'Your expert AI assistant for Web Research & Audits.',
    toolId: 'audit',
  },
];

/**
 * Voxle-inspired Welcome Screen: Clean large greeting, capability cards, and modern minimalist layout.
 */
export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const openTool = useToolsStore((s) => s.open);

  const handleCardClick = (card: CapabilityCard) => {
    if (card.toolId) {
      openTool(card.toolId);
    } else if (card.prompt) {
      onSuggestion(card.prompt);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 sm:gap-7 px-3 sm:px-4 py-6 sm:py-10 md:py-12 text-center select-none">
      {/* Animated Glowing Logo & Greeting */}
      <div className="flex flex-col items-center gap-3 max-w-xl mx-auto">
        <AnimatedLogo size="xl" className="mb-1" />
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-foreground font-sans">
          Good to see you, Zonaed.
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-normal leading-relaxed max-w-md px-2">
          Zonaed AI your personal and expert AI assistant for pretty much any tasks you can imagine.
        </p>
      </div>

      {/* Mobile Pills View (shown on narrow/phone screens) */}
      <div className="flex sm:hidden flex-wrap items-center justify-center gap-1.5 max-w-sm">
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => handleCardClick(c)}
              className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition-all hover:bg-accent hover:border-primary/40 active:scale-95"
            >
              <Icon className={cn('h-3.5 w-3.5', c.iconColor)} />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop 5 Capability Cards (Horizontal row / grid with crisp white cards & soft borders) */}
      <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-5xl">
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => handleCardClick(c)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-border hover:shadow-md hover:shadow-black/5 active:scale-[0.98]"
            >
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shadow-2xs',
                  c.iconBg,
                )}
              >
                <Icon className={cn('h-4.5 w-4.5', c.iconColor)} />
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                  {c.label}
                </span>
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {c.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}