/**
 * Signature for the on-demand content-script bridge. The injected bundle
 * (src/content-script/index.ts) attaches an implementation to
 * `globalThis.__localAgentBridge` inside the page's isolated world; the
 * background / side panel call it with chrome.scripting.executeScript({ func }).
 */
import type {
  AutomationResult,
  AutomationStep,
  FormFieldInfo,
  PageContent,
  ScrapeResult,
} from '@/shared/types';

export interface LocalAgentBridge {
  readonly version: string;
  /** Readability-based article extraction. */
  extractPage(): PageContent;
  snapshotPage(): PageContent;
  /** Structured extraction: links, emails, tables, product listings. */
  scrapePage(): ScrapeResult;
  /** Enumerate visible form fields for autofill mapping. */
  detectFormFields(): FormFieldInfo[];
  /**
   * Fill form fields from a profile ({key, value}[]). Keys are matched
   * case-insensitively against field name/label/placeholder/id.
   */
  fillFormFields(values: { key: string; value: string }[]): AutomationResult;
  /**
   * Execute an AI-generated action plan (Phase 3). `confirm` steps are only
   * executed when `allowConfirmed` is true — the UI must never pass that
   * without an explicit user confirmation dialog.
   */
  applyActions(
    actions: AutomationStep[],
    opts: { allowConfirmed: boolean },
  ): Promise<AutomationResult>;
  /** Extract WhatsApp Web chat list leads (names, numbers, unread count). */
  extractWhatsAppLeads?(): Promise<any[]>;
  /** Send message in active WhatsApp Web chat. */
  sendWhatsAppMessage?(text: string): Promise<boolean>;
  /** Open WhatsApp Web chat by contact name or phone. */
  openWhatsAppChat?(nameOrPhone: string): Promise<boolean>;
  /** Extract YouTube video metadata, chapters, and captions/transcript. */
  extractYouTubeData?(): Promise<import('@/shared/types').YouTubeVideoData>;
}

declare global {
  interface Window {
    __localAgentBridge?: LocalAgentBridge;
  }
}