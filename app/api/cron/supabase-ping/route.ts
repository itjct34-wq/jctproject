import { NextRequest, NextResponse } from 'next/server';
import {
  assertCronAuthorized,
  runSupabasePing,
} from '@/lib/system-health/supabase-ping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron keep-alive for Supabase free-tier inactivity pause.
 * Secure with CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 */
async function handle(request: NextRequest) {
  if (!assertCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runSupabasePing('cron');
  return NextResponse.json(
    {
      ok: result.ok,
      latency_ms: result.latencyMs,
      host: result.supabaseHost,
      at: result.createdAt,
      error: result.errorMessage,
    },
    { status: result.ok ? 200 : 503 }
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
