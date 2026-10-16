/*
# System health pings (Supabase keep-alive)

Stores cron and manual connectivity checks so admins can monitor last
success/failure and recent history. Inserts are service-role only;
authenticated admins may SELECT.
*/

CREATE TABLE IF NOT EXISTS public.system_health_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('cron', 'manual')),
  ok boolean NOT NULL,
  latency_ms integer,
  error_message text,
  supabase_host text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_health_pings_created_at_idx
  ON public.system_health_pings (created_at DESC);

COMMENT ON TABLE public.system_health_pings IS
  'Lightweight Supabase connectivity ping results for keep-alive cron and admin monitor.';

ALTER TABLE public.system_health_pings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.system_health_pings FROM anon, authenticated;
GRANT SELECT ON public.system_health_pings TO authenticated;

DROP POLICY IF EXISTS system_health_pings_select_admin ON public.system_health_pings;
CREATE POLICY system_health_pings_select_admin
  ON public.system_health_pings
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Optional summary keys in system_config for quick last-status reads
INSERT INTO public.system_config (key, value, description, updated_at)
VALUES (
  'supabase_last_ping',
  jsonb_build_object(
    'ok', null,
    'at', null,
    'source', null,
    'latency_ms', null,
    'error', null,
    'host', null
  ),
  'Last Supabase keep-alive ping summary (updated by cron/manual health checks).',
  now()
)
ON CONFLICT (key) DO NOTHING;
