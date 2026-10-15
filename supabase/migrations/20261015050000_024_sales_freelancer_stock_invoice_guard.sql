/*
# Sales agent & freelancer guards (vehicles + invoices)

Reinforces that sales_agent and freelancer cannot insert or delete vehicles,
or delete invoices. Extends invoice SELECT/INSERT (and line items) for selling roles.

Canonical helpers: is_admin_user(), has_role(text).
*/

-- Vehicles: insert limited to admin / operations / manager (not sales_agent or freelancer)
DROP POLICY IF EXISTS "vehicles_insert_operations" ON public.vehicles;
CREATE POLICY "vehicles_insert_operations" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_admin_user()
      OR public.has_role('operations')
      OR public.has_role('manager')
    )
  );

-- Vehicles: delete admin-only (sales_agent / freelancer cannot delete)
DROP POLICY IF EXISTS "vehicles_delete_admin" ON public.vehicles;
CREATE POLICY "vehicles_delete_admin" ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- Invoices: sales roles can read their selling workspace data
DROP POLICY IF EXISTS "invoices_select_ops" ON public.invoices;
CREATE POLICY "invoices_select_ops" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('accounts')
    OR public.has_role('auditor')
    OR public.has_role('sales_agent')
    OR public.has_role('freelancer')
  );

-- Invoices: create for finance + selling roles (not delete)
DROP POLICY IF EXISTS "invoices_insert_ops" ON public.invoices;
CREATE POLICY "invoices_insert_ops" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_admin_user()
      OR public.has_role('manager')
      OR public.has_role('accounts')
      OR public.has_role('sales_agent')
      OR public.has_role('freelancer')
    )
  );

DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- Invoice line items: allow freelancer on create paths aligned with invoices_insert_ops
DROP POLICY IF EXISTS "invoice_items_insert_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_insert_parent" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.is_admin_user()
          OR public.has_role('manager')
          OR public.has_role('accounts')
          OR public.has_role('sales_agent')
          OR public.has_role('freelancer')
        )
    )
  );

DROP POLICY IF EXISTS "invoice_items_update_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_update_parent" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.is_admin_user()
          OR public.has_role('manager')
          OR public.has_role('accounts')
          OR public.has_role('sales_agent')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.is_admin_user()
          OR public.has_role('manager')
          OR public.has_role('accounts')
          OR public.has_role('sales_agent')
        )
    )
  );
