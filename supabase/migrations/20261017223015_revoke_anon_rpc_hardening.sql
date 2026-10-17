-- 054: Re-harden SECURITY DEFINER execute grants flagged by Supabase advisors.
-- Keep public token verification RPCs callable by anon (QR / verify-quotation page).
-- Trigger helpers and staff-only helpers must not be executable by anon.

-- Trigger / provisioning helpers: not callable via PostgREST (any role)
REVOKE EXECUTE ON FUNCTION public.ensure_agent_verification_for_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_self_role_assignment() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;

-- Staff helpers: authenticated only (idempotent grants)
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- Public tokenized verification (browser + QR flows)
GRANT EXECUTE ON FUNCTION public.verify_quotation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_invoice(text) TO anon, authenticated;

-- Rate-limit attempt tables stay RLS-on with no policies (service role / bypass only).
-- Documented intentionally; do not add open policies.
COMMENT ON TABLE public.inquiry_submission_attempts IS
  'RLS enabled, no policies: inserts/selects via service role from /api/public/inquiries only.';
COMMENT ON TABLE public.agent_verification_attempts IS
  'RLS enabled, no policies: inserts/selects via service role from /api/public/verify-agent only.';
