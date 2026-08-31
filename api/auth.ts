import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const MASTER_PIN = process.env.MASTER_PIN || '1234';
const JWT_SECRET = process.env.JWT_SECRET || 'zonaed-ai-secret-key-2026-secure-token';

/**
 * Creates a signed HMAC session token valid for 30 days.
 */
function createToken(pin: string): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${pin}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

/**
 * Validates a signed session token.
 */
export function verifyToken(token: string): boolean {
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

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { pin, token } = req.body || {};

  // If verifying existing token
  if (token) {
    const isValid = verifyToken(token);
    return res.status(200).json({ valid: isValid });
  }

  // If verifying new PIN submission
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  if (String(pin).trim() !== MASTER_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const sessionToken = createToken(MASTER_PIN);
  return res.status(200).json({
    success: true,
    token: sessionToken,
    message: 'Authenticated successfully',
  });
}
