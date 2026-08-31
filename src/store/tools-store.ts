import { create } from 'zustand';

export type ToolId =
  | 'tabs'
  | 'ocr'
  | 'scrape'
  | 'fill'
  | 'automate'
  | 'social'
  | 'marketing'
  | 'audit'
  | 'spy'
  | 'outreach'
  | 'whatsapp'
  | 'youtube'
  | 'recipes'
  | 'watch'
  | null;

interface ToolsState {
  active: ToolId;
  open(tool: Exclude<ToolId, null>): void;
  close(): void;
}

/** Which tool dialog is open in the side panel (one at a time). */
export const useToolsStore = create<ToolsState>()((set) => ({
  active: null,
  open: (active) => set({ active }),
  close: () => set({ active: null }),
}));