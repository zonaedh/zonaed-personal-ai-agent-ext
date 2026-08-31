import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify PIN auth header if present
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || (req.headers['x-master-pin'] as string);

  const hasMasterKey = Boolean(process.env.MASTER_PIN);
  const isAuthenticated = !hasMasterKey || (token && verifyToken(token));

  const models = [
    {
      id: 'auto',
      name: 'Auto (Smart Quota Router)',
      provider: 'auto',
      badge: 'Zero Downtime',
      description: 'Smart auto-failover between Gemini, Groq, and OpenRouter',
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      provider: 'gemini',
      badge: 'Fast & Smart',
      description: 'Google flagship speed & 1M context model',
    },
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      provider: 'gemini',
      badge: 'Reasoning',
      description: 'Google hybrid speed and deep reasoning model',
    },
    {
      id: 'groq:qwen/qwen3.6-27b',
      name: 'Qwen 3.6 27B (Groq)',
      provider: 'groq',
      badge: 'Ultra Fast',
      description: '500+ tokens/sec multilingual assistant on Groq Cloud',
    },
    {
      id: 'openrouter:openrouter/free',
      name: 'OpenRouter Free Auto',
      provider: 'openrouter',
      badge: 'Auto · Free',
      description: 'Routes automatically to the best available free model on OpenRouter',
    },
    {
      id: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free',
      name: 'Nemotron 120B (OpenRouter)',
      provider: 'openrouter',
      badge: '120B · Free',
      description: 'Nvidia Nemotron 120B high-capacity assistant via OpenRouter',
    },
  ];

  return res.status(200).json({
    models,
    serverStatus: 'online',
    requiresAuth: hasMasterKey,
    authenticated: Boolean(isAuthenticated),
  });
}
