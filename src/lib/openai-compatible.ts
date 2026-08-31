/**
 * OpenAI-Compatible Streaming Client for Groq, OpenRouter, and DeepSeek.
 * Supports streaming chat completions with Server-Sent Events (SSE).
 */
import type { ChatRoleMessageLite, ChatStreamEvent } from '@/lib/ollama';

export interface CloudModelDef {
  id: string;
  name: string;
  provider: 'groq' | 'openrouter' | 'deepseek';
  badge: string;
  description: string;
}

export const CLOUD_MODELS: CloudModelDef[] = [
  // Groq (Ultra-Fast Free Tier - Verified Live)
  {
    id: 'groq:qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B (Groq)',
    provider: 'groq',
    badge: 'Bangla & Copy · Ultra Fast',
    description: 'Next-gen Qwen model on Groq LPUs at 500+ tokens/sec',
  },
  {
    id: 'groq:openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (Groq)',
    provider: 'groq',
    badge: '120B Reasoning · Free',
    description: 'Massive open 120B reasoning model powered by Groq',
  },
  {
    id: 'groq:openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (Groq)',
    provider: 'groq',
    badge: 'Fast Reasoning · Free',
    description: 'High-speed reasoning and code analysis on Groq',
  },
  {
    id: 'groq:qwen/qwen3.6-27b',
    name: 'Qwen 3.6 27B (Groq)',
    provider: 'groq',
    badge: 'Multilingual · Free',
    description: 'Fast versatile multilingual assistant on Groq',
  },

  // OpenRouter (Free Tier)
  {
    id: 'openrouter:openrouter/free',
    name: 'OpenRouter Free Auto (Best Free Model)',
    provider: 'openrouter',
    badge: 'Auto · Free',
    description: 'Routes automatically to the best available free model on OpenRouter',
  },
  {
    id: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 120B (OpenRouter Free)',
    provider: 'openrouter',
    badge: '120B · Free',
    description: 'Nvidia Nemotron 120B high-capacity assistant via OpenRouter',
  },
  {
    id: 'openrouter:minimax/minimax-m3:free',
    name: 'MiniMax M3 (OpenRouter Free)',
    provider: 'openrouter',
    badge: 'Fast · Free',
    description: 'High-speed reasoning and writing assistant via OpenRouter',
  },

  // DeepSeek Official API
  {
    id: 'deepseek:deepseek-reasoner',
    name: 'DeepSeek R1 (Official)',
    provider: 'deepseek',
    badge: 'Official R1',
    description: 'Official DeepSeek R1 reasoning API',
  },
  {
    id: 'deepseek:deepseek-chat',
    name: 'DeepSeek V3 (Official)',
    provider: 'deepseek',
    badge: 'Official V3',
    description: 'Official DeepSeek V3 chat model',
  },
];

export function isCloudModel(model: string | null | undefined): boolean {
  if (!model) return false;
  return model.startsWith('groq:') || model.startsWith('openrouter:') || model.startsWith('deepseek:');
}

export function parseCloudModel(model: string): { provider: 'groq' | 'openrouter' | 'deepseek'; rawModel: string } {
  if (model.startsWith('groq:')) {
    return { provider: 'groq', rawModel: model.replace('groq:', '') };
  }
  if (model.startsWith('openrouter:')) {
    return { provider: 'openrouter', rawModel: model.replace('openrouter:', '') };
  }
  if (model.startsWith('deepseek:')) {
    return { provider: 'deepseek', rawModel: model.replace('deepseek:', '') };
  }
  return { provider: 'groq', rawModel: model };
}

export interface StreamOpenAIParams {
  apiKey: string;
  provider: 'groq' | 'openrouter' | 'deepseek';
  rawModel: string;
  messages: ChatRoleMessageLite[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

export async function* streamOpenAICompatibleChat(
  params: StreamOpenAIParams,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const { apiKey, provider, rawModel, messages, systemPrompt, signal } = params;

  let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  } else if (provider === 'deepseek') {
    endpoint = 'https://api.deepseek.com/v1/chat/completions';
  }

  const formattedMessages: { role: string; content: string }[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  for (const m of messages) {
    // If we already added systemPrompt above, skip duplicate system role messages in history
    if (m.role === 'system') continue;
    formattedMessages.push({
      role: m.role,
      content: m.content,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey.trim()}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://zonaed.ai';
    headers['X-Title'] = 'Zonaed AI Browser Agent';
  }

  const body = JSON.stringify({
    model: rawModel,
    messages: formattedMessages,
    stream: true,
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    signal,
  });

  if (!res.ok) {
    let errText = '';
    try {
      const errJson = await res.json();
      errText = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errText = await res.text().catch(() => '');
    }
    throw new Error(`${provider.toUpperCase()} API Error (${res.status}): ${errText || res.statusText}`);
  }

  if (!res.body) {
    throw new Error('Response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') {
          yield { delta: '', done: true };
          return;
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const deltaObj = parsed.choices?.[0]?.delta;
            const deltaContent = deltaObj?.content ?? deltaObj?.reasoning ?? deltaObj?.reasoning_content ?? '';
            if (deltaContent) {
              yield { delta: deltaContent, done: false };
            }
          } catch {
            // Partial JSON chunk — continue
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { delta: '', done: true };
}

/** Test an API key with standard /models endpoint validation */
export async function testOpenAICompatibleKey(
  provider: 'groq' | 'openrouter' | 'deepseek',
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    let endpoint = 'https://api.groq.com/openai/v1/models';
    if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/models';
    } else if (provider === 'deepseek') {
      endpoint = 'https://api.deepseek.com/v1/models';
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey.trim()}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://zonaed.ai';
      headers['X-Title'] = 'Zonaed AI';
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `${res.status}: ${err.slice(0, 120)}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Connection failed.' };
  }
}
