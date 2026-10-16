-- 043: Sales / freelancer cannot mutate remittances
--
-- Migration 034 granted payments.create/edit to sales_agent & freelancer and
-- allowed is_selling_role() to INSERT/UPDATE payments and allocate stock.
-- Product rule: selling roles keep payments.view (list + TT docs) only;
-- remittance Actions (add/edit/allocate/deallocate) require admin/manager/accounts
-- (or an explicit user Grant of payments.create|edit|allocate).

-- ---------------------------------------------------------------------------
-- Role defaults: strip remittance mutate from selling roles
-- ---------------------------------------------------------------------------

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name IN ('sales_agent', 'freelancer')
  AND p.module = 'payments'
  AND p.action IN ('create', 'edit', 'allocate', 'delete', 'confirm', 'reverse');

-- Ensure view remains for remittance list / TT open
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('sales_agent', 'freelancer')
  AND p.module = 'payments'
  AND p.action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: gate writes on has_permission (deny-wins overrides still apply)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "payments_insert_ops" ON public.payments;
CREATE POLICY "payments_insert_ops" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_permission('payments', 'create')
  );

DROP POLICY IF EXISTS "payments_update_ops" ON public.payments;
CREATE POLICY "payments_update_ops" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.has_permission('payments', 'edit'))
  WITH CHECK (public.has_permission('payments', 'edit'));

DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;
CREATE POLICY "payments_delete_admin" ON public.payments
  FOR DELETE TO authenticated
  USING (
    public.has_permission('payments', 'delete')
    OR public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('accounts')
  );

DROP POLICY IF EXISTS "payment_allocations_insert" ON public.payment_allocations;
CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_permission('payments', 'allocate')
      OR public.has_permission('payments', 'create')
      OR public.has_permission('payments', 'edit')
    )
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id)
  );

DROP POLICY IF EXISTS "payment_allocations_update" ON public.payment_allocations;
CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('payments', 'allocate')
    OR public.has_permission('payments', 'create')
    OR public.has_permission('payments', 'edit')
  )
  WITH CHECK (
    public.has_permission('payments', 'allocate')
    OR public.has_permission('payments', 'create')
    OR public.has_permission('payments', 'edit')
  );

DROP POLICY IF EXISTS "payment_allocations_delete" ON public.payment_allocations;
CREATE POLICY "payment_allocations_delete" ON public.payment_allocations
  FOR DELETE TO authenticated
  USING (
    public.has_permission('payments', 'allocate')
    OR public.has_permission('payments', 'create')
    OR public.has_permission('payments', 'edit')
  );

COMMENT ON POLICY "payments_insert_ops" ON public.payments IS
  '043: insert requires payments.create (not selling-role ownership alone)';
COMMENT ON POLICY "payments_update_ops" ON public.payments IS
  '043: update requires payments.edit';
COMMENT ON POLICY "payment_allocations_insert" ON public.payment_allocations IS
  '043: allocate requires payments.allocate (or create/edit)';
