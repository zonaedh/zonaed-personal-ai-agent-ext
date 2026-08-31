/**
 * chrome.storage.local access with a localStorage fallback so the UI also runs
 * when previewed in a plain browser tab during development (where chrome.storage
 * is unavailable). Persisted under reserved keys.
 */

export interface StorageArea {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'local-ai-agent:';

function tryChromeStorage(): StorageArea | null {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) return chromeStorageArea;
  } catch {
    /* not in an extension context */
  }
  return null;
}

const chromeStorageArea: StorageArea = {
  async get<T>(key: string): Promise<T | undefined> {
    const res = await chrome.storage.local.get(PREFIX + key);
    return res[PREFIX + key] as T | undefined;
  },
  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [PREFIX + key]: value });
  },
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(PREFIX + key);
  },
};

function localStorageArea(): StorageArea {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    },
    async remove(key: string): Promise<void> {
      window.localStorage.removeItem(PREFIX + key);
    },
  };
}

let cachedArea: StorageArea | null | undefined;

export function getStorageArea(): StorageArea {
  if (cachedArea) return cachedArea;
  cachedArea = tryChromeStorage() ?? localStorageArea();
  return cachedArea;
}

export const SETTINGS_KEY = 'settings';
export const PENDING_TASK_KEY = 'pending-task';

/** Singleton accessor used by stores/pages. */
export const settingsStorage = {
  get<T>(): Promise<T | undefined> {
    return getStorageArea().get<T>(SETTINGS_KEY);
  },
  set(value: unknown): Promise<void> {
    return getStorageArea().set(SETTINGS_KEY, value);
  },
};

export const pendingTaskStorage = {
  get<T>(): Promise<T | undefined> {
    return getStorageArea().get<T>(PENDING_TASK_KEY);
  },
  set(value: unknown): Promise<void> {
    return getStorageArea().set(PENDING_TASK_KEY, value);
  },
  remove(): Promise<void> {
    return getStorageArea().remove(PENDING_TASK_KEY);
  },
};