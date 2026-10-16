/*
# 042 — User permission overrides + fine-grained action keys

Extends RBAC so admins can grant/deny individual permissions per user
on top of role defaults. Adds stock/remittance action keys used by the UI.

## New

1. **user_permissions** — per-user grant or deny for a permission
2. **has_permission** — deny override > grant override > role_permissions
3. **get_my_permissions()** — effective (module, action) list for the caller
4. Fine-grained permissions: payments.allocate, vehicles.reserve/assign/
   set_bid_requester/edit_courier/edit_shipping
5. Role seed alignment with current ERP UI (sales vs accounts/manager/admin)
6. RLS: admin/super_admin manage role_permissions + user_permissions
*/

-- ============================================
-- USER_PERMISSIONS (per-user grant / deny)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('grant', 'deny')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
  ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id
  ON public.user_permissions(permission_id);

DROP TRIGGER IF EXISTS user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions_select_own_or_admin" ON public.user_permissions;
CREATE POLICY "user_permissions_select_own_or_admin"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "user_permissions_insert_admin" ON public.user_permissions;
CREATE POLICY "user_permissions_insert_admin"
  ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_permissions_update_admin" ON public.user_permissions;
CREATE POLICY "user_permissions_update_admin"
  ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "user_permissions_delete_admin" ON public.user_permissions;
CREATE POLICY "user_permissions_delete_admin"
  ON public.user_permissions FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- Admins (not only super_admin) may manage role ↔ permission mappings from the UI
DROP POLICY IF EXISTS "role_permissions_all_super_admin" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_all_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_all_admin"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Permissions catalog: admins may insert new keys if needed (seed normally covers this)
DROP POLICY IF EXISTS "permissions_all_super_admin" ON public.permissions;
DROP POLICY IF EXISTS "permissions_all_admin" ON public.permissions;
CREATE POLICY "permissions_all_admin"
  ON public.permissions FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ============================================
-- has_permission: user overrides + roles
-- ============================================
CREATE OR REPLACE FUNCTION public.has_permission(_module text, _action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    -- Explicit deny for this user wins
    WHEN EXISTS (
      SELECT 1
      FROM public.user_permissions up
      JOIN public.permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
        AND up.effect = 'deny'
        AND p.module = _module
        AND p.action = _action
    ) THEN false
    -- Explicit grant for this user
    WHEN EXISTS (
      SELECT 1
      FROM public.user_permissions up
      JOIN public.permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
        AND up.effect = 'grant'
        AND p.module = _module
        AND p.action = _action
    ) THEN true
    -- Role defaults
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND p.module = _module
        AND p.action = _action
    ) THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

-- Effective permission list for the signed-in user (UI / auth bootstrap)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (module text, action text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH role_perms AS (
    SELECT DISTINCT p.module, p.action, p.id AS permission_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
  ),
  grants AS (
    SELECT p.module, p.action, p.id AS permission_id
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND up.effect = 'grant'
  ),
  denies AS (
    SELECT p.id AS permission_id
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = auth.uid()
      AND up.effect = 'deny'
  ),
  combined AS (
    SELECT module, action, permission_id FROM role_perms
    UNION
    SELECT module, action, permission_id FROM grants
  )
  SELECT c.module, c.action
  FROM combined c
  WHERE c.permission_id NOT IN (SELECT permission_id FROM denies)
  ORDER BY c.module, c.action;
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- ============================================
-- SEED: fine-grained permissions
-- ============================================
INSERT INTO public.permissions (module, action, description) VALUES
  ('payments', 'allocate', 'Allocate / deallocate remittances to reserved stock'),
  ('vehicles', 'reserve', 'Reserve available stock for a customer'),
  ('vehicles', 'assign', 'Assign available stock to a sales agent'),
  ('vehicles', 'set_bid_requester', 'Set or clear bid requester on a vehicle'),
  ('vehicles', 'edit_courier', 'Edit courier / document tracking on a vehicle'),
  ('vehicles', 'edit_shipping', 'Edit shipping stage and freight details on a vehicle')
ON CONFLICT (module, action) DO UPDATE
SET description = EXCLUDED.description;

-- ============================================
-- SEED: role grants for new keys (+ align manager/ops with UI)
-- ============================================

-- Super admin: all (including new)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: all except settings.edit, users.assign_roles, users.delete
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
  AND NOT (
    (p.module = 'settings' AND p.action = 'edit')
    OR (p.module = 'users' AND p.action = 'assign_roles')
    OR (p.module = 'users' AND p.action = 'delete')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager: remittance mutate, stock edit ops, expenses (match current UI)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'manager'
  AND (
    (p.module = 'payments' AND p.action IN ('view', 'create', 'edit', 'confirm', 'allocate', 'export', 'view_costs'))
    OR (p.module = 'vehicles' AND p.action IN (
      'view', 'create', 'edit', 'export', 'import', 'view_costs',
      'reserve', 'assign', 'set_bid_requester', 'edit_courier', 'edit_shipping'
    ))
    OR (p.module = 'expenses' AND p.action IN ('view', 'create', 'edit', 'approve', 'export'))
    OR (p.module = 'invoices' AND p.action IN ('view', 'create', 'edit', 'finalize', 'export', 'credit_note'))
    OR (p.module = 'customers' AND p.action IN ('view', 'create', 'edit', 'export', 'assign'))
    OR (p.module = 'sales' AND p.action IN ('view', 'create', 'edit', 'approve', 'cancel'))
    OR (p.module = 'auctions' AND p.action IN ('view', 'create', 'edit', 'export'))
    OR (p.module = 'purchases' AND p.action IN ('view', 'create', 'edit', 'approve'))
    OR (p.module = 'shipments' AND p.action IN ('view', 'create', 'edit', 'export'))
    OR (p.module = 'documents' AND p.action IN ('view', 'create', 'edit', 'download'))
    OR (p.module = 'tasks' AND p.action IN ('view', 'create', 'edit', 'approve', 'assign'))
    OR (p.module = 'notifications' AND p.action IN ('view', 'manage'))
    OR (p.module = 'reports' AND p.action IN ('view', 'view_financials', 'export'))
    OR (p.module = 'users' AND p.action = 'view')
    OR (p.module = 'dashboard' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations: stock ops + expenses (no remittance mutate)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'operations'
  AND (
    (p.module = 'vehicles' AND p.action IN (
      'view', 'create', 'edit', 'export', 'import', 'view_costs',
      'assign', 'set_bid_requester', 'edit_courier', 'edit_shipping', 'reserve'
    ))
    OR (p.module = 'expenses' AND p.action IN ('view', 'create', 'edit', 'export'))
    OR (p.module = 'payments' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accounts: remittance mutate + allocate + expenses (no stock edit / bid / courier)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'accounts'
  AND (
    (p.module = 'payments' AND p.action IN ('view', 'create', 'edit', 'confirm', 'reverse', 'allocate', 'export', 'view_costs'))
    OR (p.module = 'expenses' AND p.action IN ('view', 'create', 'edit', 'approve', 'export'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales agent: reserve stock only among new keys (no remittance mutate, no bid/courier/shipping/import/expenses)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'sales_agent'
  AND p.module = 'vehicles'
  AND p.action = 'reserve'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Freelancer: same reserve
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'freelancer'
  AND (
    (p.module = 'vehicles' AND p.action = 'reserve')
    OR (p.module = 'invoices' AND p.action IN ('view', 'create'))
    OR (p.module = 'payments' AND p.action = 'view')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Auditor: view-only on new keys not needed
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'auditor'
  AND p.module = 'payments'
  AND p.action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public.user_permissions IS
  'Per-user permission grant/deny overrides. Deny wins over role and grant. Managed by admin/super_admin only.';
COMMENT ON FUNCTION public.get_my_permissions() IS
  'Returns effective module/action pairs for auth.uid() after applying user_permissions overrides.';
