import { create } from 'zustand';
import { getOllamaInfo, listOllamaModels } from '@/lib/ollama';
import { isGeminiModel } from '@/lib/gemini';
import { isCloudModel } from '@/lib/openai-compatible';
import type { OllamaModel } from '@/shared/types';
import { useSettingsStore } from '@/store/settings-store';

export type OllamaStatus = 'checking' | 'online' | 'offline';

interface OllamaState {
  status: OllamaStatus;
  models: OllamaModel[];
  selectedModel: string | null;
  version?: string;
  modelsError?: string;
  lastCheckedAt: number;
  refresh(force?: boolean): Promise<void>;
  selectModel(model: string): Promise<void>;
  ensureModel(): Promise<string | null>;
  testConnection(url: string): Promise<boolean>;
}

/**
 * Connection + dynamic model list store. Models are ALWAYS fetched live from
 * `/api/tags` — never hardcoded (spec §9). Refresh is debounced to avoid
 * hammering Ollama on every React render.
 */
export const useOllamaStore = create<OllamaState>()((set, get) => ({
  status: 'checking',
  models: [],
  selectedModel: 'groq:qwen/qwen3.8-27b',
  lastCheckedAt: 0,

  async refresh(force = false) {
    const baseUrl = useSettingsStore.getState().ollamaBaseUrl;
    if (!force && Date.now() - get().lastCheckedAt < 8000) return;
    set({ status: 'checking' });

    let version: string | undefined;
    try {
      const info = await getOllamaInfo(baseUrl);
      if (!info.ok) {
        set({
          status: 'offline',
          models: [],
          version: undefined,
          lastCheckedAt: Date.now(),
        });
        return;
      }
      version = info.version;
    } catch {
      set({ status: 'offline', models: [], lastCheckedAt: Date.now() });
      return;
    }

    try {
      const models = await listOllamaModels(baseUrl);
      set({ status: 'online', models, version, modelsError: undefined, lastCheckedAt: Date.now() });
    } catch (err) {
      set({
        status: 'online',
        models: [],
        version,
        modelsError: err instanceof Error ? err.message : String(err),
        lastCheckedAt: Date.now(),
      });
    }

    // Restore the last-used model if it still exists; otherwise pick the most
    // recently modified one from the live list or keep the Gemini/Cloud model.
    const selected = get().selectedModel;
    const saved = useSettingsStore.getState().lastModel;
    if (selected === 'auto' || isGeminiModel(selected) || isCloudModel(selected)) {
      // Keep selected Auto, Gemini or Cloud model
    } else if (saved === 'auto' || isGeminiModel(saved) || isCloudModel(saved)) {
      set({ selectedModel: saved });
    } else if (!selected || !get().models.some((m) => m.name === selected)) {
      const next = get().models.some((m) => m.name === saved)
        ? saved
        : (saved || 'groq:qwen/qwen3.8-27b');
      set({ selectedModel: next });
      void useSettingsStore.getState().update({ lastModel: next });
    }
  },

  async selectModel(model: string) {
    set({ selectedModel: model });
    void useSettingsStore.getState().update({ lastModel: model });
  },

  async ensureModel(): Promise<string | null> {
    if (get().selectedModel) return get().selectedModel;
    const saved = useSettingsStore.getState().lastModel;
    if (saved) {
      set({ selectedModel: saved });
      return saved;
    }
    if (get().status === 'online' && get().models.length > 0) {
      const first = get().models[0]?.name ?? null;
      set({ selectedModel: first });
      void useSettingsStore.getState().update({ lastModel: first });
      return first;
    }
    return 'groq:qwen/qwen3.8-27b';
  },

  async testConnection(url: string): Promise<boolean> {
    const info = await getOllamaInfo(url);
    return info.ok;
  },
}));