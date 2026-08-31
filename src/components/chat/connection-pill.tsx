import { RefreshCw, Sparkles, Zap, Globe, Cpu, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/util';
import { isLargeModel } from '@/lib/ollama';
import { isGeminiModel, GEMINI_MODELS } from '@/lib/gemini';
import { isCloudModel, CLOUD_MODELS } from '@/lib/openai-compatible';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { Badge } from '@/components/ui/badge';

/**
 * The "Connected model" pill. Shows Auto Router, Gemini, Groq, OpenRouter, DeepSeek or Ollama status.
 */
export function ConnectionPill() {
  const status = useOllamaStore((s) => s.status);
  const version = useOllamaStore((s) => s.version);
  const models = useOllamaStore((s) => s.models);
  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const refresh = useOllamaStore((s) => s.refresh);

  const isAuto = selectedModel === 'auto' || !selectedModel;
  const isGemini = isGeminiModel(selectedModel);
  const geminiDef = GEMINI_MODELS.find((m) => m.id === selectedModel);

  const isCloud = isCloudModel(selectedModel);
  const cloudDef = CLOUD_MODELS.find((m) => m.id === selectedModel);

  if (isAuto) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
        title="Smart Quota Router active — automatically routes between Groq, Gemini & Local AI"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="max-w-[120px] truncate font-semibold">Auto Quota Router</span>
        <Badge variant="secondary" className="px-1 py-0 text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
          Zero Downtime
        </Badge>
      </div>
    );
  }

  if (isGemini) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400"
        title="Google Gemini Cloud AI connected and active"
      >
        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="max-w-[120px] truncate">{geminiDef?.name ?? selectedModel}</span>
        <Badge variant="secondary" className="px-1 py-0 text-[9px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
          Cloud
        </Badge>
      </div>
    );
  }

  if (isCloud) {
    const isGroq = cloudDef?.provider === 'groq';
    const isDeepSeek = cloudDef?.provider === 'deepseek';
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
          isGroq
            ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
            : isDeepSeek
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
        )}
        title={`${cloudDef?.name} active`}
      >
        <span className={cn('h-2 w-2 rounded-full animate-pulse', isGroq ? 'bg-cyan-500' : isDeepSeek ? 'bg-blue-500' : 'bg-purple-500')} />
        <span className="max-w-[120px] truncate">{cloudDef?.name ?? selectedModel}</span>
        <Badge variant="secondary" className="px-1 py-0 text-[9px]">
          {isGroq ? 'Groq' : isDeepSeek ? 'DeepSeek' : 'OpenRouter'}
        </Badge>
      </div>
    );
  }

  const model = models.find((m) => m.name === selectedModel);
  const large = isLargeModel(model);

  return (
    <button
      onClick={() => void refresh(true)}
      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      title={
        status === 'online'
          ? `Ollama ${version ? `v${version} ` : ''}· ${models.length} model(s). Click to refresh.`
          : status === 'checking'
            ? 'Checking Ollama…'
            : 'Ollama isn’t running. Click to retry.'
      }
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          status === 'online' ? 'bg-emerald-500' : status === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-red-500',
        )}
      />
      <span className="max-w-[120px] truncate">
        {status === 'online' ? (models.length > 0 ? (model?.name ?? `${models.length} models`) : 'No models pulled yet') : status === 'checking' ? 'Checking…' : 'Ollama offline'}
      </span>
      {model?.size ? <span className="hidden sm:inline text-muted-foreground/70">· {formatBytes(model.size)}</span> : null}
      {large ? (
        <Badge variant="warning" className="ml-0.5 px-1.5 py-0 text-[10px]">
          {model?.paramsB?.toFixed(0)}B
        </Badge>
      ) : null}
      {status === 'offline' ? <RefreshCw className="h-3 w-3" /> : null}
    </button>
  );
}