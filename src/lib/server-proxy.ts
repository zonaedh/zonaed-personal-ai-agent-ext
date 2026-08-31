/**
 * Server Proxy Transport for Zonaed AI.
 * Securely streams chat completions through https://agent.thesharkweb.com/api/chat
 * with PIN-based session token authentication, keeping all master API keys on Vercel.
 */

import type { ChatRoleMessageLite, ChatStreamEvent } from '@/lib/ollama';

export interface StreamServerProxyParams {
  proxyUrl?: string;
  sessionToken?: string;
  pin?: string;
  model: string;
  messages: ChatRoleMessageLite[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

export const DEFAULT_PROXY_URL = 'https://agent.thesharkweb.com/api';
export const FALLBACK_PROXY_URL = 'https://zonaed-personal-ai-agent-ext.vercel.app/api';

/**
 * Verify Master PIN against the Vercel backend with automatic fallback.
 */
export async function verifyServerPin(
  proxyBaseUrl: string,
  pin: string,
): Promise<{ ok: boolean; token?: string; defaultModel?: string; error?: string }> {
  const candidates = [
    proxyBaseUrl,
    DEFAULT_PROXY_URL,
    FALLBACK_PROXY_URL,
    typeof window !== 'undefined' ? `${window.location.origin}/api` : '',
  ].filter(Boolean);

  // Deduplicate candidates
  const uniqueUrls = Array.from(new Set(candidates));

  let lastError = 'Unable to connect to server proxy.';

  for (const baseUrl of uniqueUrls) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/auth`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        return { ok: true, token: data.token, defaultModel: data.defaultModel };
      }
      if (res.status === 401) {
        return { ok: false, error: 'Invalid Master PIN. Please try again.' };
      }
      if (data.error) {
        lastError = data.error;
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { ok: false, error: lastError };
}

/**
 * Stream chat completions through the secure Vercel Serverless Proxy.
 */
export async function* streamServerProxyChat(
  params: StreamServerProxyParams,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const {
    proxyUrl = DEFAULT_PROXY_URL,
    sessionToken,
    pin,
    model,
    messages,
    systemPrompt,
    signal,
  } = params;

  const endpoint = `${proxyUrl.replace(/\/$/, '')}/chat`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  } else if (pin) {
    headers['X-Master-PIN'] = pin;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      systemPrompt,
    }),
    signal,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errMessage = errJson.error || `Server Proxy returned HTTP ${res.status}`;
    throw new Error(errMessage);
  }

  if (!res.body) {
    throw new Error('Server Proxy returned an empty stream.');
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
                delta?: string;
                done?: boolean;
                error?: string;
              };

              if (chunk.error) {
                throw new Error(chunk.error);
              }

              if (chunk.delta) {
                yield {
                  delta: chunk.delta,
                  done: Boolean(chunk.done),
                };
              }
            } catch (err: any) {
              if (err.message && !err.message.includes('JSON')) {
                throw err;
              }
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
