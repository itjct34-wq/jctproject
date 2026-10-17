import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit } from '@/lib/security/enforce-rate-limit';
import { getSupabaseUrl } from '@/lib/supabase/env';
import { runSupabasePing } from '@/lib/system-health/supabase-ping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hostFromEnv(): string {
  try {
    return new URL(getSupabaseUrl()).host;
  } catch {
    return 'unknown';
  }
}

/** GET: last ping summary + recent history (admin only). */
export async function GET(request: NextRequest) {
  const gate = await enforceRateLimit(request, 'admin-system-health', 'adminApi');
  if (gate.blocked) return gate.blocked;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const [{ data: lastConfig }, { data: history, error: historyError }] =
    await Promise.all([
      admin
        .from('system_config')
        .select('value, updated_at')
        .eq('key', 'supabase_last_ping')
        .maybeSingle(),
      admin
        .from('system_health_pings')
        .select('id, source, ok, latency_ms, error_message, supabase_host, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (historyError) {
    return NextResponse.json(
      { error: historyError.message || 'Could not load ping history' },
      { status: 500 }
    );
  }

  const summary = (lastConfig?.value ?? null) as Record<string, unknown> | null;
  const latest = history?.[0] ?? null;

  return NextResponse.json({
    supabase_host: hostFromEnv(),
    last: summary
      ? {
          ok: summary.ok ?? latest?.ok ?? null,
          at: summary.at ?? latest?.created_at ?? null,
          source: summary.source ?? latest?.source ?? null,
          latency_ms: summary.latency_ms ?? latest?.latency_ms ?? null,
          error: summary.error ?? latest?.error_message ?? null,
          host: summary.host ?? latest?.supabase_host ?? hostFromEnv(),
        }
      : latest
        ? {
            ok: latest.ok,
            at: latest.created_at,
            source: latest.source,
            latency_ms: latest.latency_ms,
            error: latest.error_message,
            host: latest.supabase_host ?? hostFromEnv(),
          }
        : null,
    history: history ?? [],
    cron_configured: Boolean(process.env.CRON_SECRET?.trim()),
  });
}

/** POST: run a manual connectivity ping (admin only). */
export async function POST(request: NextRequest) {
  const gate = await enforceRateLimit(request, 'admin-system-health-post', 'adminApi');
  if (gate.blocked) return gate.blocked;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const result = await runSupabasePing('manual');
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
