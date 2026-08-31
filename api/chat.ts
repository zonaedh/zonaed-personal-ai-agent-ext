import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const MASTER_PIN = process.env.MASTER_PIN || '301196';
const JWT_SECRET = process.env.JWT_SECRET || 'zonaed-ai-secret-key-2026-secure-token';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

/**
 * Validates a signed HMAC session token self-contained in serverless runtime.
 */
function verifyToken(token: string): boolean {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const [pin, expiresAtStr, signature] = raw.split(':');
    if (!pin || !expiresAtStr || !signature) return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) return false;
    if (pin !== MASTER_PIN) return false;

    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${pin}:${expiresAt}`).digest('hex');
    return signature === expectedSig;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Master-PIN');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. PIN Security Check
    if (MASTER_PIN) {
      const authHeader = (req.headers.authorization as string) || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || (req.headers['x-master-pin'] as string);
      const isValid = token && (verifyToken(token) || token === MASTER_PIN);

      if (!isValid) {
        return res.status(401).json({
          error: 'Unauthorized: Invalid or missing Master PIN. Access restricted to Zonaed AI authorized users.',
        });
      }
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { model = 'auto', messages = [], systemPrompt = '' } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Setup Server-Sent Events (SSE) streaming headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let resolvedModel = model;
    if (resolvedModel === 'auto') {
      if (GROQ_API_KEY) {
        resolvedModel = 'groq:qwen/qwen3.8-27b';
      } else if (GEMINI_API_KEY) {
        resolvedModel = 'gemini-3.6-flash';
      } else if (OPENROUTER_API_KEY) {
        resolvedModel = 'openrouter:openrouter/free';
      } else {
        throw new Error('No API keys configured on Vercel server. Please set GROQ_API_KEY or GEMINI_API_KEY in Vercel settings.');
      }
    }

    // Route: Google Gemini
    if (resolvedModel.startsWith('gemini-') || resolvedModel.startsWith('models/gemini-')) {
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured in Vercel environment.');
      }
      const cleanModel = resolvedModel.replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY.trim())}`;

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

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Gemini Error (${response.status}): ${errText}`);
      }

      if (!response.body) {
        throw new Error('Gemini API returned an empty stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
                const chunk = JSON.parse(jsonStr);
                const candidate = chunk.candidates?.[0];
                const delta = candidate?.content?.parts?.[0]?.text ?? '';
                const isDone = Boolean(candidate?.finishReason && candidate.finishReason !== 'STOP_UNSPECIFIED');

                if (delta) {
                  sendEvent({ delta, done: isDone, model: resolvedModel });
                }
              } catch {
                // Ignore parse errors on partial chunks
              }
            }
          }
          newlineIndex = buffer.indexOf('\n');
        }
      }

      sendEvent({ delta: '', done: true, model: resolvedModel });
      res.end();
      return;
    }

    // Route: OpenAI-compatible (Groq, OpenRouter, DeepSeek)
    let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    let apiKey = GROQ_API_KEY;
    let rawModel = resolvedModel;

    if (resolvedModel.startsWith('groq:')) {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      apiKey = GROQ_API_KEY;
      rawModel = resolvedModel.replace(/^groq:/, '');
    } else if (resolvedModel.startsWith('openrouter:')) {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      apiKey = OPENROUTER_API_KEY;
      rawModel = resolvedModel.replace(/^openrouter:/, '');
    } else if (resolvedModel.startsWith('deepseek:')) {
      endpoint = 'https://api.deepseek.com/v1/chat/completions';
      apiKey = DEEPSEEK_API_KEY;
      rawModel = resolvedModel.replace(/^deepseek:/, '');
    }

    if (!apiKey) {
      throw new Error(`API key for provider (${resolvedModel}) is not configured on Vercel.`);
    }

    const formattedMessages = [];
    if (systemPrompt && systemPrompt.trim()) {
      formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
    }
    for (const m of messages) {
      if (m.role === 'system') continue;
      formattedMessages.push({ role: m.role, content: m.content });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    };

    if (resolvedModel.startsWith('openrouter:')) {
      headers['HTTP-Referer'] = 'https://agent.thesharkweb.com';
      headers['X-Title'] = 'Zonaed AI Agent';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: rawModel,
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errDetail = errJson.error?.message || (await response.text().catch(() => ''));
      throw new Error(`Provider API Error (${response.status}): ${errDetail}`);
    }

    if (!response.body) {
      throw new Error('API returned an empty stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (jsonStr === '[DONE]') {
            sendEvent({ delta: '', done: true, model: resolvedModel });
            break;
          }
          if (jsonStr) {
            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              const finishReason = chunk.choices?.[0]?.finish_reason;
              if (delta) {
                sendEvent({ delta, done: Boolean(finishReason), model: resolvedModel });
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    }

    sendEvent({ delta: '', done: true, model: resolvedModel });
    res.end();
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: errorMsg });
    }
  }
}
