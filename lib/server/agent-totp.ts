import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

function resolveSecret(perAgentSecret?: string | null): string {
  const secret = (perAgentSecret || '').trim() || process.env.AGENT_TOTP_SECRET || '';
  if (!secret) throw new Error('AGENT_TOTP_SECRET is not configured');
  return secret;
}

export function generateAgentTotpSecret(): string {
  return randomBytes(20).toString('hex');
}

export function agentTotp(agentId: string, counter: number, perAgentSecret?: string | null): string {
  const secret = resolveSecret(perAgentSecret);
  const digest = createHmac('sha1', secret).update(`${agentId}:${counter}`).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Accept current 30s window and the previous window (clock skew / slow entry). */
export function verifyAgentTotp(
  agentId: string,
  code: string,
  now = Date.now(),
  perAgentSecret?: string | null
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30000);
  const actual = Buffer.from(code);
  for (const c of [counter, counter - 1]) {
    const expected = Buffer.from(agentTotp(agentId, c, perAgentSecret));
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }
  return false;
}
