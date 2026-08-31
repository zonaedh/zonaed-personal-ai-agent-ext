/**
 * ON-DEMAND content script (NOT declared in manifest.content_scripts).
 *
 * It is bundled via `additionalInputs` in vite.config.ts and injected into a
 * tab with chrome.scripting.executeScript({ files }) the moment the user asks
 * for it — the extension never needs persistent host access (<all_urls>).
 *
 * Once injected it exposes a small bridge on globalThis.__localAgentBridge.
 * The background/side panel then calls the bridge with executeScript({ func })
 * which runs in the SAME isolated world, so globals are shared.
 *
 * This file must stay side-effect-free (no listeners, no DOM changes) so it
 * can be safely injected repeatedly.
 */
import { Readability } from '@mozilla/readability';
import type {
  AutomationResult,
  AutomationStep,
  FormFieldInfo,
  PageContent,
  ScrapeLink,
  ScrapeProduct,
  ScrapeResult,
  ScrapeTable,
} from '@/shared/types';
import type { LocalAgentBridge } from '@/shared/bridge';

const MAX_TEXT_CHARS = 250_000;
const BRIDGE_VERSION = '1';

/* ---------------------------------------------------------------------------
 * Readability extraction (§3: never raw innerText dumps)
 * ------------------------------------------------------------------------- */

function extractPage(): PageContent {
  try {
    // Readability mutates the document it parses — always feed it a clone.
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (article?.textContent && article.textContent.trim().length > 0) {
      const text = article.textContent.replace(/\n{3,}/g, '\n\n').trim();
      return {
        ok: true,
        title: article.title || document.title,
        url: location.href,
        byline: article.byline ?? undefined,
        text: text.slice(0, MAX_TEXT_CHARS),
        excerpt: article.excerpt ?? undefined,
        length: article.length ?? text.length,
      };
    }
    // Fallback for pages Readability can't parse (SPA shells etc.).
    return fallbackExtract();
  } catch (err) {
    return fallbackExtract(err instanceof Error ? err.message : String(err));
  }
}

function fallbackExtract(reason?: string): PageContent {
  const text = (document.body?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) {
    return {
      ok: false,
      error: reason ? `No readable text on this page (${reason})` : 'No readable text on this page.',
    };
  }
  return {
    ok: true,
    title: document.title,
    url: location.href,
    text: text.slice(0, MAX_TEXT_CHARS),
    excerpt: text.slice(0, 300),
    length: text.length,
    error: reason ? `Used fallback extraction (${reason})` : undefined,
  };
}

/** Snapshot for scheduled "summarize changes" tasks (Phase 4). */
function snapshotPage(): PageContent {
  return extractPage();
}

/* ---------------------------------------------------------------------------
 * Automation primitives (Phase 3) — click / type / scroll / navigate / wait
 *
 * The AI proposes an action PLAN; the side panel shows it and the user
 * confirms. Destructive steps (confirm:true) refuse to run without an explicit
 * `allowConfirmed: true` — the UI is responsible for that dialog (§9).
 * ------------------------------------------------------------------------- */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function findElement(step: AutomationStep): Element | null {
  if (step.selector) {
    try {
      return document.querySelector(step.selector);
    } catch {
      return null;
    }
  }
  if (step.text) {
    const needle = step.text.toLowerCase();
    const candidates = document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], input[type="submit"]',
    );
    for (const el of candidates) {
      const label = (
        el.getAttribute('aria-label') ??
        el.textContent ??
        (el as HTMLInputElement).value ??
        ''
      )
        .trim()
        .toLowerCase();
      if (label && label.includes(needle)) return el;
    }
  }
  return null;
}

async function applyActions(
  actions: AutomationStep[],
  opts: { allowConfirmed: boolean },
): Promise<AutomationResult> {
  const log: string[] = [];
  const data: Record<string, unknown> = {};
  try {
    for (const step of actions) {
      if (step.confirm && !opts.allowConfirmed) {
        return {
          ok: false,
          log,
          error: `Step "${step.label ?? step.kind}" is destructive and was not confirmed by the user. Plan aborted.`,
        };
      }
      switch (step.kind) {
        case 'wait':
          await sleep(Math.min(step.waitMs ?? 500, 10_000));
          log.push(`waited ${step.waitMs ?? 500}ms`);
          break;
        case 'navigate': {
          if (!step.url) throw new Error('navigate step missing url');
          log.push(`navigating → ${step.url}`);
          location.href = step.url;
          return { ok: true, log }; // page unloads; nothing else runs here
        }
        case 'scroll': {
          const target = step.scrollTo ?? 'bottom';
          const el = document.scrollingElement ?? document.documentElement;
          if (target === 'top') el.scrollTop = 0;
          else if (target === 'bottom') el.scrollTop = el.scrollHeight;
          else el.scrollTop = (el.scrollHeight * Number(target)) / 100;
          log.push(`scrolled to ${target}`);
          break;
        }
        case 'click': {
          const el = findElement(step);
          if (!el) throw new Error(`click target not found: ${step.selector ?? step.text ?? '?'}`);
          el.scrollIntoView({ block: 'center' });
          await sleep(120);
          (el as HTMLElement).click();
          log.push(`clicked ${step.label ?? step.selector ?? step.text ?? 'element'}`);
          break;
        }
        case 'type': {
          const el = findElement(step);
          if (!el || !('value' in el)) throw new Error(`type target not found: ${step.selector ?? '?'}`);
          const input = el as HTMLInputElement | HTMLTextAreaElement;
          input.focus();
          // React-controlled inputs need the native setter + input event.
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          setter?.call(input, step.text ?? '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          log.push(`typed into ${step.selector ?? 'field'}`);
          break;
        }
        case 'submit': {
          const el = findElement(step);
          const form = el instanceof HTMLFormElement ? el : (el?.closest('form') ?? null);
          if (!form) throw new Error(`submit target not found: ${step.selector ?? '?'}`);
          form.requestSubmit();
          log.push('submitted form');
          break;
        }
        case 'read': {
          const page = extractPage();
          data.read = { title: page.title, text: page.text?.slice(0, 2000) };
          log.push(`read page (${page.text?.length ?? 0} chars)`);
          break;
        }
        default:
          throw new Error(`unknown action: ${(step as AutomationStep).kind}`);
      }
    }
    return { ok: true, log, data };
  } catch (err) {
    return { ok: false, log, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ---------------------------------------------------------------------------
 * Structured scraping (Phase 3) — links, emails, tables, product listings
 * ------------------------------------------------------------------------- */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PRICE_RE = /(?:[$€£¥]\s?\d[\d.,]*|\d[\d.,]*\s?(?:USD|EUR|GBP))/;

function scrapePage(): ScrapeResult {
  const emails = new Set<string>();
  const pageText = document.body?.innerText ?? '';
  for (const m of pageText.matchAll(EMAIL_RE)) emails.add(m[0].toLowerCase());

  // Links (deduped by href, absolute URLs only).
  const links: ScrapeLink[] = [];
  const seen = new Set<string>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = a.href;
    if (!href || !/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text && !a.querySelector('img')) continue;
    const img = a.querySelector('img');
    links.push({ text: text || img?.alt || img?.title || '(no text)', href });
    if (links.length >= 500) break;
  }

  // Tables → 2D string arrays.
  const tables: ScrapeTable[] = [];
  for (const table of document.querySelectorAll('table')) {
    const rows: string[][] = [];
    for (const tr of table.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('th,td')].map((c) =>
        (c.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 2) {
      tables.push({ rows: rows.slice(0, 200), hasHeader: table.querySelector('th') !== null });
    }
    if (tables.length >= 20) break;
  }

  // Product listings: schema.org first, then price-pattern heuristic.
  const products: ScrapeProduct[] = [];
  const pushProduct = (title: string, price?: string, link?: string): void => {
    title = title.replace(/\s+/g, ' ').trim();
    if (title && products.length < 100 && !products.some((p) => p.title === title)) {
      products.push({ title, price, link });
    }
  };
  for (const el of document.querySelectorAll('[itemtype*="schema.org/Product"]')) {
    const name = el.querySelector('[itemprop="name"]')?.textContent ?? '';
    const priceEl = el.querySelector('[itemprop="price"]');
    const price = (priceEl?.textContent ?? priceEl?.getAttribute('content') ?? '').trim() || undefined;
    const a = el.closest('a') ?? el.querySelector('a');
    pushProduct(name, price, a instanceof HTMLAnchorElement ? a.href : undefined);
  }
  if (products.length === 0) {
    for (const el of document.querySelectorAll('li, article, div')) {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 120 || text.length < 8) continue;
      const m = text.match(PRICE_RE);
      if (!m) continue;
      const a = el.querySelector('a[href]');
      const titleEl = el.querySelector('h1,h2,h3,h4,[class*="title"],[class*="name"]');
      pushProduct(titleEl?.textContent ?? text.replace(m[0], '').trim(), m[0], a instanceof HTMLAnchorElement ? a.href : undefined);
    }
  }

  return {
    url: location.href,
    title: document.title,
    scrapedAt: Date.now(),
    links,
    emails: [...emails],
    tables,
    products,
  };
}

/* ---------------------------------------------------------------------------
 * Form autofill (Phase 3)
 * ------------------------------------------------------------------------- */

function fieldSelector(el: Element, index: number): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}

function visibleFormField(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function fieldLabel(el: HTMLElement): string {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return (label.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  const wrapper = el.closest('label');
  if (wrapper) return (wrapper.textContent ?? '').replace(/\s+/g, ' ').trim();
  return el.getAttribute('aria-label') ?? '';
}

function detectFormFields(): FormFieldInfo[] {
  const fields: FormFieldInfo[] = [];
  document.querySelectorAll<HTMLElement>('input, select, textarea').forEach((el, i) => {
    const type = (el as HTMLInputElement).type ?? 'text';
    if (['hidden', 'submit', 'button', 'file', 'checkbox', 'radio', 'image', 'reset'].includes(type)) return;
    if (!visibleFormField(el)) return;
    fields.push({
      selector: fieldSelector(el, i),
      name: el.getAttribute('name') ?? el.id ?? '',
      label: fieldLabel(el),
      type,
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
    });
  });
  return fields.slice(0, 100);
}

function fillFormFields(values: { key: string; value: string }[]): AutomationResult {
  const log: string[] = [];
  let filled = 0;
  document.querySelectorAll<HTMLElement>('input, select, textarea').forEach((el, i) => {
    const type = (el as HTMLInputElement).type ?? 'text';
    if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) return;
    if (!visibleFormField(el)) return;
    const haystack = [
      el.getAttribute('name'),
      el.id,
      el.getAttribute('placeholder'),
      fieldLabel(el),
      el.getAttribute('autocomplete'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const match = values.find((v) => v.key.trim() && haystack.includes(v.key.trim().toLowerCase()));
    if (!match) return;
    if (el instanceof HTMLSelectElement) {
      const opt = [...el.options].find(
        (o) =>
          o.value.toLowerCase() === match.value.toLowerCase() ||
          o.text.toLowerCase() === match.value.toLowerCase(),
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
        log.push(`${fieldSelector(el, i)} ← "${match.key}" = ${match.value}`);
      }
      return;
    }
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (input.readOnly || input.disabled) return;
    input.focus();
    // React-controlled inputs need the native setter + input event.
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    setter?.call(input, match.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    filled++;
    log.push(`${fieldSelector(el, i)} ← "${match.key}" = ${type === 'password' ? '•••' : match.value}`);
  });
  return { ok: filled > 0, log, data: { filled, total: values.length } };
}

import {
  extractWhatsAppChatlistLeads,
  sendWhatsAppChatMessage,
  openWhatsAppChatByName,
} from './whatsapp';
import { extractYouTubeVideoData } from './youtube';
import { initGhostwriter } from './ghostwriter';

const bridge: LocalAgentBridge = {
  version: BRIDGE_VERSION,
  extractPage,
  snapshotPage,
  scrapePage,
  detectFormFields,
  fillFormFields,
  applyActions,
  extractWhatsAppLeads: extractWhatsAppChatlistLeads,
  sendWhatsAppMessage: sendWhatsAppChatMessage,
  openWhatsAppChat: openWhatsAppChatByName,
  extractYouTubeData: extractYouTubeVideoData,
};

(globalThis as unknown as { __localAgentBridge?: LocalAgentBridge }).__localAgentBridge = bridge;

// Initialize inline floating ghostwriter assistant
initGhostwriter();