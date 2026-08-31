/**
 * Ollama REST API client. Everything here is pure — callers pass the base URL
 * (from settings) and an AbortSignal for cancellation. Streaming is expected
 * everywhere: the chat endpoint returns newline-delimited JSON and we surface
 * each delta as it arrives (the ChatGPT-style feel is non-negotiable per spec).
 *
 * Because host_permissions cover http://localhost:11434 (see manifest), the
 * service worker + extension pages can call these without CORS issues.
 */

import type { ChatMessage, OllamaInfo, OllamaModel } from '@/shared/types';

export const DEFAULT_OLLAMA_BASE = 'http://localhost:11434';

/** Thrown when Ollama is unreachable or returns a non-2xx status. */
export class OllamaConnectionError extends Error {
  readonly kind: 'offline' | 'http' | 'timeout' | 'unknown';
  readonly status?: number;

  constructor(kind: OllamaConnectionError['kind'], message: string, status?: number) {
    super(message);
    this.name = 'OllamaConnectionError';
    this.kind = kind;
    this.status = status;
  }
}

export interface ChatRoleMessageLite {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatParams {
  baseUrl: string;
  model: string;
  messages: ChatRoleMessageLite[];
  signal?: AbortSignal;
  /** Passed through to Ollama's `options`. */
  options?: Record<string, unknown>;
  /** Model keep-alive duration e.g. '10m' — keeps the model warm across turns. */
  keepAlive?: string;
}

/** One streamed event from /api/chat. */
export interface ChatStreamEvent {
  delta: string;
  /** True on the final chunk (contains aggregate token stats). */
  done: boolean;
  stats?: { evalCount: number; promptEvalCount: number };
}

const jsonHeaders = { 'Content-Type': 'application/json' };

/* ---------------------------------------------------------------------------
 * Low-level fetch with timeout + readable error mapping
 * ------------------------------------------------------------------------- */

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } catch (err) {
    throw mapFetchError(err);
  } finally {
    clearTimeout(timer);
  }
}

function mapFetchError(err: unknown): Error {
  if (err instanceof Error && err.name === 'TimeoutError') {
    return new OllamaConnectionError(
      'timeout',
      'Ollama took too long to respond. It may still be loading the model.',
    );
  }
  if (err instanceof OllamaConnectionError) return err;
  if (err instanceof Error && err.name === 'AbortError') return err; // deliberate cancel
  // fetch() throws TypeError("Failed to fetch") when the connection is refused.
  return new OllamaConnectionError(
    'offline',
    'Could not reach the local Ollama server. Start Ollama and try again.',
  );
}

/** Map an HTTP error response body to a friendly Ollama error. */
async function throwForStatus(res: Response): Promise<Response> {
  if (res.ok) return res;
  let detail = '';
  try {
    const body = (await res.json()) as { error?: string };
    detail = body.error ?? '';
  } catch {
    detail = await res.text().catch(() => '');
  }
  throw new OllamaConnectionError('http', detail || `Ollama returned HTTP ${res.status}`, res.status);
}

/* ---------------------------------------------------------------------------
 * Connection health + model list + size heuristic
 * ------------------------------------------------------------------------- */

export async function getOllamaInfo(baseUrl: string): Promise<OllamaInfo> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/version`, { headers: jsonHeaders }, 3000);
    if (!res.ok) {
      throw new OllamaConnectionError(
        'http',
        `Ollama version endpoint returned HTTP ${res.status}`,
        res.status,
      );
    }
    const data = (await res.json()) as { version?: string };
    return { ok: true, baseUrl, version: data.version };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, baseUrl, error: 'Connection test cancelled.' };
    }
    return { ok: false, baseUrl, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetch installed models dynamically (never hardcoded — spec §9). */
export async function listOllamaModels(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<OllamaModel[]> {
  const res = await fetchWithTimeout(`${baseUrl}/api/tags`, { headers: jsonHeaders, signal }, 8000);
  await throwForStatus(res);
  const data = (await res.json()) as { models?: OllamaModel[] };
  const models = (data.models ?? [])
    .map((m) => ({ ...m, paramsB: estimateParamsB(m.name, m.details?.parameter_size) }))
    .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0));
  return models;
}

/**
 * Estimate parameters (billions) from the model name and Ollama's
 * `parameter_size` detail. Rough heuristic only:
 *   "llama3.1:8b"      -> 8
 *   "deepseek-r2:1.5b" -> 1.5
 *   "mixtral:8x7b"     -> 56 (8*7, MoE with 7B active)
 * Returns null when it can't tell.
 */
export function estimateParamsB(name: string, parameterSize?: string): number | null {
  const fromDetails = parameterSize?.match(/([\d.]+)\s*b/i);
  if (fromDetails?.[1]) return Number(fromDetails[1]);

  const clean = name.replace(/:draft$/, '').toLowerCase();
  const moe = clean.match(/(\d+)x(\d+)b/);
  if (moe?.[1] && moe?.[2]) {
    // MoE: total params chosen for memory sizing (all experts are loaded).
    return Number(moe[1]) * Number(moe[2]);
  }
  const single = clean.match(/([\d.]+)b/);
  if (single?.[1]) return Number(single[1]);
  return null;
}

export const LARGE_MODEL_THRESHOLD_B = 13;

export function isLargeModel(model: OllamaModel | undefined): boolean {
  if (!model) return false;
  return (model.paramsB ?? 0) > LARGE_MODEL_THRESHOLD_B;
}

/* ---------------------------------------------------------------------------
 * Retry/backoff for idempotent reads (spec §8: every Ollama call wrapped
 * with error handling + retry/backoff)
 * ------------------------------------------------------------------------- */

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Deliberate cancellation must never be retried.
      if (err instanceof Error && err.name === 'AbortError') throw err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/* ---------------------------------------------------------------------------
 * Streaming chat
 * ------------------------------------------------------------------------- */

/**
 * POST /api/chat with stream:true and yield NDJSON chunks as they arrive.
 * Callers can abort via params.signal. Throws OllamaConnectionError on failure.
 */
export async function* streamChat(
  params: StreamChatParams,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const { baseUrl, model, messages, signal, options, keepAlive } = params;
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: jsonHeaders,
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: options ?? {},
        keep_alive: keepAlive ?? '10m',
      }),
    },
    0, // no timeout on request start — cold model loading can take minutes
  );
  await throwForStatus(res);

  if (!res.body) throw new OllamaConnectionError('unknown', 'Ollama returned an empty stream.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // NDJSON — split lines, tolerating trailing partial lines.
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          const chunk = parseChunk(line);
          if (chunk) {
            yield {
              delta: chunk.message?.content ?? '',
              done: chunk.done === true,
              stats: chunk.done
                ? {
                    evalCount: chunk.eval_count ?? 0,
                    promptEvalCount: chunk.prompt_eval_count ?? 0,
                  }
                : undefined,
            };
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
      if (signal?.aborted) break;
    }
  } finally {
    reader.releaseLock();
  }
}

interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
}

function parseChunk(line: string): OllamaChatChunk | null {
  try {
    return JSON.parse(line) as OllamaChatChunk;
  } catch {
    return null; // partial/progressive JSON — next line carries on
  }
}

/* ---------------------------------------------------------------------------
 * Prompt construction helpers
 * ------------------------------------------------------------------------- */

/** Convert stored chat messages to the role/content shape Ollama expects. */
export function toOllamaMessages(messages: ChatMessage[]): ChatRoleMessageLite[] {
  const out: ChatRoleMessageLite[] = [];
  for (const msg of messages) {
    if (
      (msg.role !== 'system' && msg.role !== 'user' && msg.role !== 'assistant') ||
      !msg.content.trim()
    ) {
      continue;
    }
    out.push({ role: msg.role as 'system' | 'user' | 'assistant', content: msg.content });
  }
  return out;
}