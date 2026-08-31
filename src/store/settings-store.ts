import { create } from 'zustand';
import { DEFAULT_OLLAMA_BASE } from '@/lib/ollama';
import { settingsStorage } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';

export type AppLanguage = 'en' | 'bn';

export interface Settings {
  ollamaBaseUrl: string;
  geminiApiKey: string;
  groqApiKey?: string;
  openRouterApiKey?: string;
  deepSeekApiKey?: string;
  theme: ThemeMode;
  /** Total context budget in characters fed to the model per turn. */
  maxContextChars: number;
  /** Last selected model — remembered across restarts (spec §4 Phase 1). */
  lastModel: string | null;
  /** Default target language for "Translate selection". */
  translateTargetLang: string;
  /** Primary AI response language ('en' for English, 'bn' for Bangla). */
  language: AppLanguage;
}

export const DEFAULT_SETTINGS: Settings = {
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE,
  geminiApiKey: 'AQ.Ab8RN6JeRTzQTrJXdvOHT1KfKdW15G1EhC1ybSoiQ9JV7Ygi9Q',
  groqApiKey: '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',
  openRouterApiKey: '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',
  deepSeekApiKey: '',
  theme: 'system',
  maxContextChars: 40000,
  lastModel: 'auto',
  translateTargetLang: 'English',
  language: 'en',
};

interface SettingsState extends Settings {
  /** True once settings were hydrated from chrome.storage.local. */
  ready: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  ready: true,

  async load() {
    let stored: Partial<Settings> | undefined;
    try {
      stored = await settingsStorage.get<Partial<Settings>>();
    } catch {
      // storage unavailable (e.g. plain-browser dev preview) — use defaults
    }
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(stored ?? {}),
      groqApiKey: stored?.groqApiKey || DEFAULT_SETTINGS.groqApiKey,
      geminiApiKey: stored?.geminiApiKey || DEFAULT_SETTINGS.geminiApiKey,
      openRouterApiKey: stored?.openRouterApiKey || DEFAULT_SETTINGS.openRouterApiKey,
    };
    set({ ...merged, ready: true });
    applyTheme(merged.theme);
  },

  async update(patch: Partial<Settings>) {
    const next = { ...get(), ...patch };
    set(patch);
    applyTheme(next.theme);
    try {
      const { ready, load, update, ...persisted } = next;
      await settingsStorage.set(persisted);
    } catch {
      // non-fatal: settings just don't persist outside an extension context
    }
  },
}));

// Real-time synchronization across Chrome Extension runtimes (Options tab <-> Sidepanel <-> Popup)
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['local-ai-agent:settings']) {
      const newSettings = changes['local-ai-agent:settings'].newValue as Partial<Settings> | undefined;
      if (newSettings && typeof newSettings === 'object') {
        const current = useSettingsStore.getState();
        useSettingsStore.setState({ ...current, ...newSettings });
        if (newSettings.theme) {
          applyTheme(newSettings.theme);
        }
      }
    }
  });
}