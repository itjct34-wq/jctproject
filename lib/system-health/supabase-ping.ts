import { createServerClient } from '@/lib/supabase/server';
import { getSupabaseUrl } from '@/lib/supabase/env';

export type PingSource = 'cron' | 'manual';

export type PingResult = {
  ok: boolean;
  latencyMs: number;
  supabaseHost: string;
  errorMessage: string | null;
  createdAt: string;
};

function supabaseHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/**
 * Lightweight authenticated DB check + persist result for admin monitor.
 * Uses service-role client (bypasses RLS for insert + config upsert).
 */
export async function runSupabasePing(source: PingSource): Promise<PingResult> {
  const supabaseHost = supabaseHostFromUrl(getSupabaseUrl());
  const started = Date.now();
  let ok = false;
  let errorMessage: string | null = null;

  try {
    const admin = await createServerClient();
    // Cheap authenticated round-trip against an always-present table.
    const { error } = await admin.from('system_config').select('key').limit(1);
    if (error) {
      errorMessage = error.message;
    } else {
      ok = true;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown ping failure';
  }

  const latencyMs = Date.now() - started;
  const createdAt = new Date().toISOString();
  const result: PingResult = {
    ok,
    latencyMs,
    supabaseHost,
    errorMessage,
    createdAt,
  };

  try {
    const admin = await createServerClient();
    await admin.from('system_health_pings').insert({
      source,
      ok,
      latency_ms: latencyMs,
      error_message: errorMessage,
      supabase_host: supabaseHost,
      created_at: createdAt,
    });

    await admin.from('system_config').upsert(
      {
        key: 'supabase_last_ping',
        value: {
          ok,
          at: createdAt,
          source,
          latency_ms: latencyMs,
          error: errorMessage,
          host: supabaseHost,
        },
        description:
          'Last Supabase keep-alive ping summary (updated by cron/manual health checks).',
        updated_at: createdAt,
      },
      { onConflict: 'key' }
    );
  } catch {
    // Persistence failure should not hide the connectivity result.
  }

  return result;
}

export function assertCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token.length > 0 && token === secret;
}
