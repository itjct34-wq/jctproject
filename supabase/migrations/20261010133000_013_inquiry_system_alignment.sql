-- Align public inquiry fields and workflow with the live inquiry form.
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS destination_port text,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS year_from integer,
  ADD COLUMN IF NOT EXISTS year_to integer,
  ADD COLUMN IF NOT EXISTS budget_min numeric,
  ADD COLUMN IF NOT EXISTS budget_max numeric;

ALTER TABLE public.inquiries
  DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status = ANY (ARRAY['new','in_progress','quoted','converted','closed','spam']));

CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON public.inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS agent_verification_attempts_ip_time_idx
  ON public.agent_verification_attempts(ip_hash, attempted_at DESC);

-- Rate-limit/audit records must only be written by trusted server routes.
ALTER TABLE public.agent_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_verification_attempts FROM anon, authenticated;
