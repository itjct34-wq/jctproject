-- Server-side inquiry/OTP rate limits and strict super-admin global configuration writes.
DROP POLICY IF EXISTS system_config_write ON public.system_config;
CREATE POLICY system_config_write ON public.system_config FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.name='super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.name='super_admin'));

DROP POLICY IF EXISTS inquiries_public_insert ON public.inquiries;
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_currency_check;

CREATE TABLE IF NOT EXISTS public.inquiry_submission_attempts (
 id bigserial PRIMARY KEY,
 ip_hash text NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiry_submission_attempts_ip_time_idx ON public.inquiry_submission_attempts(ip_hash,attempted_at DESC);
ALTER TABLE public.inquiry_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiry_submission_attempts FROM anon,authenticated;

CREATE TABLE IF NOT EXISTS public.agent_verification_attempts (
 id bigserial PRIMARY KEY,
 ip_hash text NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now(),
 succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS agent_verification_attempts_ip_time_idx ON public.agent_verification_attempts(ip_hash,attempted_at DESC);
ALTER TABLE public.agent_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_verification_attempts FROM anon,authenticated;
