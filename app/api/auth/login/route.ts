import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  RATE_LIMITS,
  clientIp,
  rateLimit,
  rateLimitHeaders,
} from '@/lib/security/rate-limit';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit(`auth-login:${ip}`, ip, RATE_LIMITS.authLogin);
  if (!limited.success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Valid email and password are required' },
      { status: 400, headers: rateLimitHeaders(limited) }
    );
  }

  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });
    if (error || !data.session) {
      return NextResponse.json(
        { error: error?.message || 'Invalid email or password' },
        { status: 401, headers: { ...rateLimitHeaders(limited), 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: { id: data.session.user.id, email: data.session.user.email },
      },
      { status: 200, headers: { ...rateLimitHeaders(limited), 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Login service temporarily unavailable' },
      { status: 503, headers: rateLimitHeaders(limited) }
    );
  }
}
