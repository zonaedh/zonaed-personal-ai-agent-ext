/**
 * Scheduled page watch (Phase 4) — "check this page daily and summarize
 * changes". Tasks live in chrome.storage.local; each gets a chrome.alarms
 * entry. The alarm fires in the service worker, which reads the page (only
 * works while the tab is open AND the user granted that site access via the
 * multi-tab attach flow) and compares a cheap hash of the readable text.
 */
import type { WatchTask } from '@/shared/types';
import { getStorageArea } from '@/lib/storage';
import { uid } from '@/lib/util';

const WATCH_KEY = 'watch-tasks';

function watchStorage() {
  return getStorageArea();
}

export async function listWatchTasks(): Promise<WatchTask[]> {
  return (await watchStorage().get<WatchTask[]>(WATCH_KEY)) ?? [];
}

async function saveTasks(tasks: WatchTask[]): Promise<void> {
  await watchStorage().set(WATCH_KEY, tasks);
}

export async function addWatchTask(url: string, label: string, intervalHours: number): Promise<WatchTask> {
  const task: WatchTask = {
    id: uid(),
    url,
    label: label || new URL(url).hostname,
    intervalHours: Math.max(1, Math.min(intervalHours, 168)),
    createdAt: Date.now(),
  };
  const tasks = await listWatchTasks();
  await saveTasks([...tasks, task]);
  // Period must respect Chrome's minimum (30s); we clamp to hours anyway.
  await chrome.alarms.create(`watch-${task.id}`, {
    periodInMinutes: Math.max(15, task.intervalHours * 60),
  });
  return task;
}

export async function removeWatchTask(id: string): Promise<void> {
  await saveTasks((await listWatchTasks()).filter((t) => t.id !== id));
  await chrome.alarms.clear(`watch-${id}`);
}

/** Used by the background alarm handler to persist change-detection state. */
export async function updateWatchTask(id: string, patch: Partial<WatchTask>): Promise<void> {
  const tasks = await listWatchTasks();
  await saveTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

/** Cheap, stable string hash for change detection (FNV-1a). */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}