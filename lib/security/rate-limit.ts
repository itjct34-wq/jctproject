import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** true when falling back to process-local memory (not shared across serverless instances) */
  ephemeral: boolean;
};

type MemoryBucket = { count: number; resetAt: number };

const memoryStores = new Map<string, Map<string, MemoryBucket>>();

function memoryLimit(
  namespace: string,
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  let store = memoryStores.get(namespace);
  if (!store) {
    store = new Map();
    memoryStores.set(namespace, store);
  }
  const now = Date.now();
  const existing = store.get(identifier);
  if (!existing || existing.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs, ephemeral: true };
  }
  existing.count += 1;
  const success = existing.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetAt,
    ephemeral: true,
  };
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(namespace: string, limit: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  const key = `${namespace}:${limit}:${window}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `jct:rl:${namespace}`,
      analytics: false,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

/** Client IP for rate limiting (Vercel / reverse proxy). */
export function clientIp(request: NextRequest | Request): string {
  const headers = 'headers' in request ? request.headers : new Headers();
  const forwarded = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '';
  const ip = forwarded.split(',')[0]?.trim();
  return ip || 'unknown';
}

/**
 * Sliding-window rate limit. Uses Upstash Redis when UPSTASH_* env is set;
 * otherwise an in-memory LRU-style map (per instance — fine for local/dev,
 * weaker on multi-instance serverless).
 */
export async function rateLimit(
  namespace: string,
  identifier: string,
  opts: { limit: number; windowMs: number; windowLabel?: `${number} ${'s' | 'm' | 'h' | 'd'}` }
): Promise<RateLimitResult> {
  const id = identifier || 'unknown';
  if (upstashConfigured()) {
    try {
      const windowLabel =
        opts.windowLabel ||
        (opts.windowMs >= 3_600_000
          ? (`${Math.round(opts.windowMs / 3_600_000)} h` as const)
          : opts.windowMs >= 60_000
            ? (`${Math.round(opts.windowMs / 60_000)} m` as const)
            : (`${Math.max(1, Math.round(opts.windowMs / 1000))} s` as const));
      const limiter = getUpstashLimiter(namespace, opts.limit, windowLabel);
      const res = await limiter.limit(id);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
        ephemeral: false,
      };
    } catch {
      // Fall through to memory if Redis is misconfigured at runtime.
    }
  }
  return memoryLimit(namespace, id, opts.limit, opts.windowMs);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}

/** Presets for sensitive routes. */
export const RATE_LIMITS = {
  authLogin: { limit: 10, windowMs: 15 * 60 * 1000, windowLabel: '15 m' as const },
  publicInquiry: { limit: 8, windowMs: 10 * 60 * 1000, windowLabel: '10 m' as const },
  verifyAgent: { limit: 20, windowMs: 15 * 60 * 1000, windowLabel: '15 m' as const },
  verifyToken: { limit: 60, windowMs: 10 * 60 * 1000, windowLabel: '10 m' as const },
  adminApi: { limit: 60, windowMs: 5 * 60 * 1000, windowLabel: '5 m' as const },
  cron: { limit: 30, windowMs: 60 * 60 * 1000, windowLabel: '1 h' as const },
  agentCode: { limit: 120, windowMs: 5 * 60 * 1000, windowLabel: '5 m' as const },
} as const;
