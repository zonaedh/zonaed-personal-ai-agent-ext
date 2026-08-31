import { useState } from 'react';
import {
  Eye,
  FileCheck,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  Table2,
  TrendingUp,
  Wand2,
  Youtube,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useToolsStore, type ToolId } from '@/store/tools-store';
import { useOllamaStore } from '@/store/ollama-store';
import { isGeminiModel, GEMINI_MODELS } from '@/lib/gemini';
import { isCloudModel, CLOUD_MODELS } from '@/lib/openai-compatible';
import { cn } from '@/lib/cn';

interface TopicSuggestion {
  id: string;
  category: 'marketing' | 'automation' | 'creative';
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  desc: string;
  badge?: string;
  toolId?: Exclude<ToolId, null>;
  prompt?: string;
  needsPage?: boolean;
}

const TOPICS: TopicSuggestion[] = [
  {
    id: 'youtube-studio',
    category: 'creative',
    icon: Youtube,
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconColor: 'text-rose-500 dark:text-rose-400',
    label: 'YouTube to Viral LinkedIn & Carousels',
    desc: '1-click transcript to viral posts, threads & 5-slide PDF carousels',
    badge: 'Viral',
    toolId: 'youtube',
  },
  {
    id: 'whatsapp-crm',
    category: 'marketing',
    icon: MessageSquare,
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    label: 'WhatsApp Lead CRM & Extractor',
    desc: 'Extract all chat numbers, Google Sheets sync & anti-ban follow-ups',
    badge: 'Hot',
    toolId: 'whatsapp',
  },
  {
    id: 'marketing-plan',
    category: 'marketing',
    icon: TrendingUp,
    iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    label: '360° Digital Marketing Plan',
    desc: 'Deep website research, SMM, paid ads & Google Docs sync',
    badge: 'Popular',
    toolId: 'marketing',
  },
  {
    id: 'client-audit',
    category: 'marketing',
    icon: FileCheck,
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    label: 'Client Website Audit & Proposal',
    desc: 'Find conversion blockers, SEO gaps & generate proposal',
    badge: 'Agency',
    toolId: 'audit',
  },
  {
    id: 'competitor-spy',
    category: 'marketing',
    icon: Eye,
    iconBg: 'bg-pink-500/10 dark:bg-pink-500/20',
    iconColor: 'text-pink-500 dark:text-pink-400',
    label: 'Competitor Ad & Strategy Spy',
    desc: 'Reverse-engineer competitor offers, hooks & marketing angles',
    badge: 'Spy',
    toolId: 'spy',
  },
  {
    id: 'cold-outreach',
    category: 'marketing',
    icon: Send,
    iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    iconColor: 'text-cyan-500 dark:text-cyan-400',
    label: 'LinkedIn & Cold Outreach Pitch',
    desc: 'Craft high-converting personalized pitches & cold emails',
    badge: 'High-ROI',
    toolId: 'outreach',
  },
  {
    id: 'summarize-page',
    category: 'automation',
    icon: FileText,
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconColor: 'text-blue-500 dark:text-blue-400',
    label: 'Summarize Active Webpage',
    desc: 'Extract key insights, structured takeaways & action plan',
    needsPage: true,
    prompt: '',
  },
  {
    id: 'sheets-sync',
    category: 'automation',
    icon: Table2,
    iconBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    iconColor: 'text-teal-500 dark:text-teal-400',
    label: 'Extract Data to Google Sheets',
    desc: 'Extract tables, links & leads with 1-click TSV sheet copy',
    toolId: 'scrape',
  },
  {
    id: 'social-post',
    category: 'creative',
    icon: Wand2,
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    iconColor: 'text-purple-500 dark:text-purple-400',
    label: 'Viral Social Post & Content',
    desc: 'Hook-driven LinkedIn, X, and Facebook copy with zero AI cliches',
    toolId: 'social',
  },
];

type CategoryFilter = 'all' | 'marketing' | 'automation' | 'creative';

const FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All Topics' },
  { id: 'marketing', label: '🚀 Growth & Marketing' },
  { id: 'automation', label: '⚡ Automation & Data' },
  { id: 'creative', label: '✍️ Copywriting' },
];

/** Welcome screen for Zonaed AI: Animated glowing avatar + categorized topic navigation. */
export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const openTool = useToolsStore((s) => s.open);
  const selectedModel = useOllamaStore((s) => s.selectedModel);

  const isGemini = isGeminiModel(selectedModel);
  const geminiDef = GEMINI_MODELS.find((m) => m.id === selectedModel);
  const isCloud = isCloudModel(selectedModel);
  const cloudDef = CLOUD_MODELS.find((m) => m.id === selectedModel);

  const modelDisplayName = isGemini
    ? geminiDef?.name ?? 'Gemini Cloud AI'
    : isCloud
      ? cloudDef?.name ?? 'Cloud AI'
      : selectedModel
        ? `Ollama · ${selectedModel}`
        : 'Local & Cloud AI';

  const filteredTopics =
    filter === 'all' ? TOPICS : TOPICS.filter((t) => t.category === filter);

  const handleTopicClick = (topic: TopicSuggestion) => {
    if (topic.toolId) {
      openTool(topic.toolId);
    } else {
      onSuggestion(topic.needsPage ? '' : topic.prompt || '');
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 px-3 py-6 text-center animate-aurora">
      <div className="flex flex-col items-center gap-2.5">
        {/* Animated glowing Z emblem */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 text-xl font-black text-white shadow-xl shadow-indigo-500/30 animate-glow ring-2 ring-white/20">
          <span className="animate-float">Z</span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-lg font-extrabold tracking-tight gradient-text font-sans">
            Zonaed AI
          </h1>
          <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground font-sans">
            Personal Autonomous Browser Agent · <span className="font-semibold text-foreground/80">{modelDisplayName}</span>
          </p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center justify-center gap-1 max-w-sm">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
              filter === f.id
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-500'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Categorized Topic Cards */}
      <div className="grid w-full max-w-md grid-cols-1 gap-2">
        {filteredTopics.map((s) => (
          <button
            key={s.id}
            onClick={() => handleTopicClick(s)}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/80 p-2.5 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:bg-accent/60 hover:shadow-md hover:shadow-indigo-500/5"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
                s.iconBg,
              )}
            >
              <s.icon className={cn('h-4 w-4', s.iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {s.label}
                </span>
                {s.badge ? (
                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-bold text-indigo-500 shrink-0">
                    {s.badge}
                  </span>
                ) : (
                  <Sparkles className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-indigo-400 shrink-0" />
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                {s.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}