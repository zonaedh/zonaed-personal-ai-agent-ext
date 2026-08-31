/**
 * Theme helpers — "dark/light/system with system preference detection" (§7).
 * Applied on every extension surface (sidepanel/popup/options) by swapping the
 * `.dark` class + color-scheme on <html>.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export function isSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? (isSystemDark() ? 'dark' : 'light') : mode;
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolveTheme(mode) === 'dark');
  document.documentElement.style.colorScheme = resolveTheme(mode);
}

export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}