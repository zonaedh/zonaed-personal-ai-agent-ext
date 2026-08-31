import { RefreshCw, Loader2, Gauge, Sparkles, Zap, Globe, Cpu } from 'lucide-react';
import { isLargeModel } from '@/lib/ollama';
import { GEMINI_MODELS, isGeminiModel } from '@/lib/gemini';
import { CLOUD_MODELS, isCloudModel } from '@/lib/openai-compatible';
import { formatBytes } from '@/lib/util';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

/**
 * Dynamic model switcher — supports Smart Auto Routing, Google Gemini, Groq, OpenRouter, DeepSeek & Local Ollama.
 */
export function ModelPicker() {
  const status = useOllamaStore((s) => s.status);
  const models = useOllamaStore((s) => s.models);
  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const selectModel = useOllamaStore((s) => s.selectModel);
  const refresh = useOllamaStore((s) => s.refresh);

  const selectedOllama = models.find((m) => m.name === selectedModel);
  const large = isLargeModel(selectedOllama);
  const isAuto = selectedModel === 'auto';
  const isGemini = isGeminiModel(selectedModel);
  const isCloud = isCloudModel(selectedModel);

  const groqModels = CLOUD_MODELS.filter((m) => m.provider === 'groq');
  const openRouterModels = CLOUD_MODELS.filter((m) => m.provider === 'openrouter');
  const deepseekModels = CLOUD_MODELS.filter((m) => m.provider === 'deepseek');

  const picker = (
    <div className="flex items-center gap-1">
      <Select
        value={selectedModel ?? 'auto'}
        onChange={(e) => void selectModel(e.target.value)}
        aria-label="Chat model"
        className="h-8 max-w-[130px] xs:max-w-[160px] sm:max-w-[210px] md:max-w-none truncate rounded-full border border-border/80 bg-card px-2.5 sm:px-3.5 py-1 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-accent focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
      >
        <optgroup label="⚡ Groq Cloud (Ultra-Fast LPU Inference)">
          {groqModels.map((m) => (
            <option key={m.id} value={m.id}>
              ⚡ {m.name} · {m.badge}
            </option>
          ))}
        </optgroup>
        <optgroup label="✨ Google Gemini (Cloud · 1M Context)">
          {GEMINI_MODELS.map((gm) => (
            <option key={gm.id} value={gm.id}>
              ✨ {gm.name} · {gm.badge}
            </option>
          ))}
        </optgroup>
        <optgroup label="🚀 Smart Quota &amp; Failover Router">
          <option value="auto">
            🚀 Auto (Smart Quota Router) · Zero Downtime
          </option>
        </optgroup>
        <optgroup label="🌐 OpenRouter (Free Tier Models)">
          {openRouterModels.map((m) => (
            <option key={m.id} value={m.id}>
              🌐 {m.name} · {m.badge}
            </option>
          ))}
        </optgroup>
        <optgroup label="🐋 DeepSeek (Official API)">
          {deepseekModels.map((m) => (
            <option key={m.id} value={m.id}>
              🐋 {m.name} · {m.badge}
            </option>
          ))}
        </optgroup>
        <optgroup label="🦙 Local Ollama (Offline)">
          {models.length === 0 ? (
            <option value="" disabled>
              {status === 'online' ? 'No local models pulled' : 'Local Ollama offline'}
            </option>
          ) : (
            models.map((m) => (
              <option key={m.name} value={m.name}>
                🦙 {m.name} · {formatBytes(m.size) || '?'}
              </option>
            ))
          )}
        </optgroup>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void refresh(true)}
        disabled={status === 'checking'}
        aria-label="Refresh local model list"
        title="Refresh local model list"
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        {status === 'checking' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );

  if (large) {
    return (
      <TooltipProvider>
        <TooltipRoot>
          <TooltipTrigger asChild>{picker}</TooltipTrigger>
          <TooltipContent side="top">
            <p className="flex items-center gap-1.5 text-xs text-amber-500">
              <Gauge className="h-3.5 w-3.5" />
              Large model ({selectedOllama?.paramsB?.toFixed(0)}B params) — may run slower on modest hardware.
            </p>
          </TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    );
  }

  return picker;
}