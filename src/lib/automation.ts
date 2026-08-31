/**
 * AI-generated automation plans (Phase 3).
 *
 * The model proposes a JSON array of AutomationStep actions; the user previews
 * and confirms before anything runs (spec §4/§9 — destructive steps like
 * submit/purchase always require an explicit confirmation and are refused by
 * the content-script bridge otherwise).
 */
import type { AutomationStep } from '@/shared/types';
import { streamChat } from '@/lib/ollama';
import { uid } from '@/lib/util';

const PLAN_SCHEMA = `[
  {"id":"1","kind":"click","selector":"#submit","label":"Open search"},
  {"id":"2","kind":"type","selector":"input[name=q]","text":"query","label":"Type query"},
  {"id":"3","kind":"wait","waitMs":1000,"label":"Wait for results"},
  {"id":"4","kind":"scroll","scrollTo":"bottom","label":"Load more"},
  {"id":"5","kind":"navigate","url":"https://example.com","confirm":true,"label":"Go to page"},
  {"id":"6","kind":"read","label":"Capture page text"}
]`;

const PLAN_SYSTEM = `You are a browser-automation planner. Given a goal and a summary of the current page, output a JSON array of steps that accomplishes the goal in the user's browser.

Allowed step kinds: click, type, scroll, navigate, wait, read, submit.
Rules:
- Output ONLY the JSON array. No markdown fences, no commentary.
- Every step needs: id (string, sequential), kind, and a short human "label".
- click/type/submit need "selector" (CSS) — infer the most likely selector from the page summary; use "text" as a fallback matcher for buttons/links by label.
- "type" also needs "text".
- "scroll" needs "scrollTo": "top" | "bottom" | "0".."100".
- "wait" needs "waitMs" (max 10000).
- "navigate" needs "url".
- Steps that leave the page, submit forms, or spend money MUST set "confirm": true. When in doubt, set confirm: true.
- Prefer the fewest steps that reach the goal. Never invent steps the page can't support.

Example shape:
${PLAN_SCHEMA}`;

/** Strip markdown fences and extract the first JSON array from LLM output. */
export function parsePlan(raw: string): AutomationStep[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('The model did not return a JSON plan.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Plan JSON was not an array.');

  const validKinds = new Set(['click', 'type', 'scroll', 'navigate', 'read', 'wait', 'submit']);
  const steps: AutomationStep[] = [];
  for (const [i, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const kind = String(s.kind ?? '');
    if (!validKinds.has(kind)) continue;
    steps.push({
      id: String(s.id ?? uid()),
      kind: kind as AutomationStep['kind'],
      selector: typeof s.selector === 'string' ? s.selector : undefined,
      text: typeof s.text === 'string' ? s.text : undefined,
      url: typeof s.url === 'string' ? s.url : undefined,
      scrollTo: typeof s.scrollTo === 'string' ? s.scrollTo : undefined,
      waitMs: typeof s.waitMs === 'number' ? Math.min(s.waitMs, 10_000) : undefined,
      label: typeof s.label === 'string' ? s.label : `${kind} step ${i + 1}`,
      confirm: s.confirm === true,
    });
  }
  if (steps.length === 0) throw new Error('The plan contained no usable steps.');
  return steps;
}

/** Ask the model for an action plan for `goal` against the current page. */
export async function generatePlan(opts: {
  baseUrl: string;
  model: string;
  goal: string;
  pageText: string;
  signal?: AbortSignal;
}): Promise<AutomationStep[]> {
  let raw = '';
  for await (const evt of streamChat({
    baseUrl: opts.baseUrl,
    model: opts.model,
    signal: opts.signal,
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      {
        role: 'user',
        content: `Goal: ${opts.goal.trim()}\n\nPage summary (title/url first, then readable text):\n${opts.pageText.slice(0, 6000)}`,
      },
    ],
  })) {
    raw += evt.delta;
  }
  return parsePlan(raw);
}