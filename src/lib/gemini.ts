/**
 * Google Gemini API Client for Chrome Extension.
 * Supports streaming chat completions with SSE (Server-Sent Events) via
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse
 */

import type { ChatMessage } from '@/shared/types';
import type { ChatRoleMessageLite, ChatStreamEvent } from '@/lib/ollama';

export interface GeminiModelDef {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export const GEMINI_MODELS: GeminiModelDef[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Fast & Smart',
    description: 'Latest flagship speed & reasoning model from Google',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Fast',
    description: 'High-speed multivariable assistant',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Balanced',
    description: 'Balanced low-latency cloud model',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Ultra-low latency lightweight cloud model',
  },
];

export function isGeminiModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return model.startsWith('gemini-') || model.startsWith('models/gemini-');
}

export interface StreamGeminiChatParams {
  apiKey: string;
  model: string;
  messages: ChatRoleMessageLite[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

/**
 * Stream responses from Google Gemini API via SSE.
 * Yields ChatStreamEvent ({ delta, done }) compatible with the chat UI.
 */
export async function* streamGeminiChat(
  params: StreamGeminiChatParams,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const { apiKey, model, messages, systemPrompt, signal } = params;

  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  // Convert role messages to Gemini contents format
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }

  const requestBody: Record<string, unknown> = { contents };

  if (systemPrompt && systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      errorDetail = errJson.error?.message ?? '';
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(errorDetail || `Google Gemini returned HTTP ${res.status}`);
  }

  if (!res.body) {
    throw new Error('Gemini API returned an empty stream.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr) {
            try {
              const chunk = JSON.parse(jsonStr) as {
                candidates?: Array<{
                  content?: { parts?: Array<{ text?: string }> };
                  finishReason?: string;
                }>;
                usageMetadata?: {
                  candidatesTokenCount?: number;
                  promptTokenCount?: number;
                };
              };

              const candidate = chunk.candidates?.[0];
              const text = candidate?.content?.parts?.[0]?.text ?? '';
              const isCandidateDone = Boolean(candidate?.finishReason && candidate.finishReason !== 'STOP_UNSPECIFIED');

              if (text) {
                yield {
                  delta: text,
                  done: isCandidateDone,
                  stats: chunk.usageMetadata
                    ? {
                        evalCount: chunk.usageMetadata.candidatesTokenCount ?? 0,
                        promptEvalCount: chunk.usageMetadata.promptTokenCount ?? 0,
                      }
                    : undefined,
                };
              }
            } catch {
              // progressive chunk — ignore json parse errors on malformed lines
            }
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }

      if (signal?.aborted) break;
    }
  } finally {
    reader.releaseLock();
  }

  yield { delta: '', done: true };
}

/** Test if a Gemini API key is valid */
export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Synchronous/one-shot text generation with Gemini */
export async function generateGeminiText(
  apiKey: string,
  prompt: string,
  model = 'gemini-2.5-flash',
): Promise<string> {
  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gemini API error (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
