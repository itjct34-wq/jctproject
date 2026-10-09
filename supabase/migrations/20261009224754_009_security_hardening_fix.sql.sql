-- Security hardening: fix function search_path and revoke PUBLIC EXECUTE on SECURITY DEFINER functions
-- Safe to re-run: all statements are idempotent

-- 1. Fix update_updated_at: set search_path explicitly
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Revoke EXECUTE from PUBLIC on all SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.check_self_role_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;

-- 3. Re-grant EXECUTE to authenticated only
GRANT EXECUTE ON FUNCTION public.check_self_role_assignment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;