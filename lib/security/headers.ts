import type { NextResponse } from 'next/server';

/**
 * Helmet-equivalent defaults for Next.js.
 *
 * CSP tradeoffs (intentional):
 * - `script-src` allows `'unsafe-inline'` / `'unsafe-eval'` so Next.js App Router
 *   hydration and some client bundles keep working without a nonce pipeline.
 * - `style-src` allows `'unsafe-inline'` for Tailwind / Radix inline styles.
 * - `img-src` allows `https: data: blob:` for Supabase storage, crop previews,
 *   and print/QR data URLs. Tighten later with nonces + explicit hosts if needed.
 * - Capacitor WebViews that load the production HTTPS origin inherit these headers;
 *   if you ship a fully offline file:// bundle, CSP may need scheme exceptions.
 */
export function contentSecurityPolicy(): string {
  const supabaseHost = (() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      if (!url) return null;
      return new URL(url).host;
    } catch {
      return null;
    }
  })();

  const connectExtra = supabaseHost
    ? ` https://${supabaseHost} wss://${supabaseHost}`
    : ' https://*.supabase.co wss://*.supabase.co';

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${connectExtra}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Security headers applied from next.config and middleware. */
export function securityHeaderTuples(options?: { includeHsts?: boolean }): [string, string][] {
  const includeHsts = options?.includeHsts ?? process.env.NODE_ENV === 'production';
  const headers: [string, string][] = [
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    [
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    ],
    ['X-DNS-Prefetch-Control', 'on'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Content-Security-Policy', contentSecurityPolicy()],
  ];
  if (includeHsts) {
    headers.push(['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload']);
  }
  return headers;
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of securityHeaderTuples()) {
    response.headers.set(key, value);
  }
  return response;
}
