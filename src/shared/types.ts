/**
 * Types shared across all extension contexts (side panel, popup, options,
 * background SW, injected content script). Keep this file dependency-free so
 * every bundle can import it.
 */

export type Role = 'user' | 'assistant' | 'system' | 'tool';

/** Attachments a user explicitly attached for model context (never implicit). */
export interface ChatAttachment {
  kind: 'page' | 'selection' | 'tab' | 'image';
  label: string;
  content: string;
  url?: string;
  addedAt: number;
}

export type ChatMessageStatus = 'streaming' | 'done' | 'error' | 'stopped';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Set for assistant messages that failed mid-generation. */
  error?: string;
  /** Model used to generate; set on assistant messages. */
  model?: string;
  status?: ChatMessageStatus;
}

/** Lightweight session header for the history list. */
export interface ChatSessionMeta {
  id: number;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
}

/* ---------------------------------------------------------------------------
 * Ollama
 * ------------------------------------------------------------------------- */

export interface OllamaModel {
  name: string;
  model: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quant_level?: string;
  };
  /** Params in billions, derived from name/details for the VRAM warning. */
  paramsB?: number | null;
}

export interface OllamaInfo {
  ok: boolean;
  baseUrl: string;
  version?: string;
  /** Human-readable reason when !ok. */
  error?: string;
}

export interface OllamaChatStats {
  evalCount?: number;
  promptEvalCount?: number;
  evalDurationMs?: number;
  totalDurationMs?: number;
}

/* ---------------------------------------------------------------------------
 * Page reading (readability extraction, injected on demand)
 * ------------------------------------------------------------------------- */

export interface PageContent {
  ok: boolean;
  title?: string;
  url?: string;
  byline?: string;
  text?: string;
  excerpt?: string;
  length?: number;
  error?: string;
  /** True when activeTab wasn't granted yet (user must invoke the extension). */
  needsActivation?: boolean;
}

/* ---------------------------------------------------------------------------
 * Context-menu tasks
 * ------------------------------------------------------------------------- */

export type ContextTaskKind =
  | 'summarize'
  | 'rewrite'
  | 'translate'
  | 'ask-page'
  | 'quick-chat'
  | 'extract-page'
  | 'ocr';

export interface ContextTask {
  id: string;
  kind: ContextTaskKind;
  /** Selected text from a context-menu invocation. */
  selection?: string;
  pageTitle?: string;
  pageUrl?: string;
  /** Page text for 'ask-page'; filled by the caller (background/SW). */
  pageText?: string;
  /** Quick-chat text from the popup. */
  text?: string;
  /** Target language for 'translate'. */
  targetLang?: string;
  createdAt: number;
}

/* ---------------------------------------------------------------------------
 * Automation primitives (Phase 3) + recipes (Phase 4) — types live here so the
 * content-script bridge and background share one shape.
 * ------------------------------------------------------------------------- */

export type AutomationActionKind =
  | 'click'
  | 'type'
  | 'scroll'
  | 'navigate'
  | 'read'
  | 'wait'
  | 'submit';

export interface AutomationStep {
  id: string;
  kind: AutomationActionKind;
  /** CSS selector for click/type/submit. */
  selector?: string;
  text?: string;
  url?: string;
  /** Scroll target: percent 0..100 or 'top' | 'bottom'. */
  scrollTo?: string;
  /** Destructive/irreversible steps (submit/purchase-like) require confirm. */
  confirm: boolean;
  waitMs?: number;
  label?: string;
}

export interface AutomationResult {
  ok: boolean;
  log: string[];
  error?: string;
  /** Extra structured results from 'read' actions. */
  data?: unknown;
}

/** Round-trip payload used by side panel <-> background automation messages. */
export interface PlaybookRun {
  id: string;
  name: string;
  steps: AutomationStep[];
  runAt: number;
}

/** Snapshot of a page for scheduled "summarize changes" tasks (Phase 4). */
export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  takenAt: number;
}

/* ---------------------------------------------------------------------------
 * Structured scraping (Phase 3)
 * ------------------------------------------------------------------------- */

export interface ScrapeLink {
  text: string;
  href: string;
}

export interface ScrapeTable {
  /** First row is the header row when the table has <th> cells. */
  rows: string[][];
  hasHeader: boolean;
}

export interface ScrapeProduct {
  title: string;
  price?: string;
  link?: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  scrapedAt: number;
  links: ScrapeLink[];
  emails: string[];
  tables: ScrapeTable[];
  products: ScrapeProduct[];
}

/* ---------------------------------------------------------------------------
 * Form autofill (Phase 3)
 * ------------------------------------------------------------------------- */

export interface FormFieldInfo {
  selector: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
}

/* ---------------------------------------------------------------------------
 * Scheduled page watch (Phase 4)
 * ------------------------------------------------------------------------- */

export interface WatchTask {
  id: string;
  url: string;
  label: string;
  intervalHours: number;
  /** Hash of the last-seen readable text (change detection). */
  lastHash?: string;
  lastTitle?: string;
  createdAt: number;
  lastCheckedAt?: number;
}

/* ---------------------------------------------------------------------------
 * YouTube Repurposing Studio (Feature 5)
 * ------------------------------------------------------------------------- */

export interface YouTubeChapter {
  time: string;
  title: string;
}

export interface YouTubeVideoData {
  ok: boolean;
  videoId?: string;
  url?: string;
  title?: string;
  author?: string;
  channelUrl?: string;
  views?: string;
  description?: string;
  chapters?: YouTubeChapter[];
  transcript?: string;
  error?: string;
}