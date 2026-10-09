-- Security hardening: fix function search_path and revoke anon EXECUTE on SECURITY DEFINER functions
-- Safe to re-run: all statements are idempotent (REVOKE is a no-op if already revoked, CREATE OR REPLACE updates in place)

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

-- 2. Revoke EXECUTE from anon on all SECURITY DEFINER helper functions
-- These are RBAC helpers that should only be callable by authenticated users.
-- handle_new_user is a Postgres trigger function (not RPC-called), so revoking anon is safe.
REVOKE EXECUTE ON FUNCTION public.check_self_role_assignment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(_module text, _action text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(_role_name text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- 3. Ensure authenticated can still execute the RBAC helper functions
GRANT EXECUTE ON FUNCTION public.has_permission(_module text, _action text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_role_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
