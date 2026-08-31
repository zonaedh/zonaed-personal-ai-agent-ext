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
  serverProxyUrl: string;
  pinSessionToken?: string;
  masterPin?: string;
  pinLockEnabled: boolean;
  isLocked: boolean;
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
  geminiApiKey: '',
  groqApiKey: '',
  openRouterApiKey: '',
  deepSeekApiKey: '',
  serverProxyUrl: 'https://zonaed-personal-ai-agent-ext.vercel.app/api',
  pinSessionToken: '',
  masterPin: '',
  pinLockEnabled: true,
  isLocked: true,
  theme: 'system',
  maxContextChars: 40000,
  lastModel: 'auto',
  translateTargetLang: 'English',
  language: 'en',
};

interface SettingsState extends Settings {
  /** True once settings were hydrated from chrome.storage.local. */
  ready: boolean;
  settingsOpen: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
  unlock(): void;
  lock(): void;
  openSettings(): void;
  closeSettings(): void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  ready: true,
  settingsOpen: false,

  unlock() {
    set({ isLocked: false });
  },

  lock() {
    set({ isLocked: true });
  },

  openSettings() {
    set({ settingsOpen: true });
  },

  closeSettings() {
    set({ settingsOpen: false });
  },

  async load() {
    let stored: Partial<Settings> | undefined;
    try {
      stored = await settingsStorage.get<Partial<Settings>>();
    } catch {
      // storage unavailable (e.g. plain-browser dev preview) — use defaults
    }
    const currentIsLocked = get().isLocked;
    const isFirstLoad = !get().ready;
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(stored ?? {}),
      // Only enforce initial lock on fresh cold start; never re-lock an active unlocked session
      isLocked: isFirstLoad
        ? (stored?.pinLockEnabled ?? DEFAULT_SETTINGS.pinLockEnabled)
        : currentIsLocked,
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