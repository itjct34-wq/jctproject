import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  RATE_LIMITS,
  clientIp,
  rateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from '@/lib/security/rate-limit';

type Preset = keyof typeof RATE_LIMITS;

/**
 * Returns a 429 response when over limit; otherwise null.
 * Callers should still run their own auth / business checks.
 */
export async function enforceRateLimit(
  request: NextRequest,
  namespace: string,
  preset: Preset
): Promise<{ blocked: NextResponse } | { blocked: null; result: RateLimitResult }> {
  const ip = clientIp(request);
  const result = await rateLimit(`${namespace}:${ip}`, ip, RATE_LIMITS[preset]);
  if (!result.success) {
    return {
      blocked: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(result) }
      ),
    };
  }
  return { blocked: null, result };
}
