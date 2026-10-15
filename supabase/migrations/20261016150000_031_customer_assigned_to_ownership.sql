/*
# Customer assignment is the sales relationship owner (RLS)

Selling roles (sales_agent, freelancer) see a customer when assigned_to is them
(or assigned_to is null and they created the row — legacy). Quotes, invoices,
and sales follow the customer's assigned_to, not invoice created_by, so a
hand-off hides the deal from the previous agent. created_by stays for audit.

Elevated staff still see all. Selling staff may reassign a customer they
currently own (WITH CHECK allows a new assigned_to).
*/

-- Legacy rows: treat creator as owner when unassigned.
UPDATE public.customers
SET assigned_to = created_by
WHERE assigned_to IS NULL
  AND created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.customer_owned_by_agent(p_customer_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND COALESCE(c.assigned_to, c.created_by) = p_user_id
  );
$$;

-- Selling commercial row: customer assignee owns the deal; untagged rows stay with creator.
CREATE OR REPLACE FUNCTION public.selling_owns_deal(p_customer_id uuid, p_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_customer_id IS NOT NULL THEN public.sales_owns_customer(p_customer_id)
    ELSE p_created_by = auth.uid()
  END;
$$;

REVOKE ALL ON FUNCTION public.customer_owned_by_agent(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.selling_owns_deal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_owned_by_agent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.selling_owns_deal(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customers_select_assigned_or_admin" ON public.customers;
CREATE POLICY "customers_select_assigned_or_admin" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
CREATE POLICY "customers_insert_authenticated" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_elevated_staff()
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_update_assigned_or_admin" ON public.customers;
CREATE POLICY "customers_update_assigned_or_admin" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.is_elevated_staff()
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_elevated_staff()
    OR assigned_to IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- Quotations / sales / invoices: follow customer assigned_to
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "quotations_select_ops" ON public.quotations;
CREATE POLICY "quotations_select_ops" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  );

DROP POLICY IF EXISTS "quotations_update_ops" ON public.quotations;
CREATE POLICY "quotations_update_ops" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  );

DROP POLICY IF EXISTS "sales_select_ops" ON public.sales;
CREATE POLICY "sales_select_ops" ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  );

DROP POLICY IF EXISTS "sales_update_ops" ON public.sales;
CREATE POLICY "sales_update_ops" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  );

DROP POLICY IF EXISTS "invoices_select_ops" ON public.invoices;
CREATE POLICY "invoices_select_ops" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (public.is_selling_role() AND public.selling_owns_deal(customer_id, created_by))
  );

DROP POLICY IF EXISTS "invoices_update_sales_own" ON public.invoices;
CREATE POLICY "invoices_update_sales_own" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_selling_role()
    AND public.selling_owns_deal(customer_id, created_by)
  )
  WITH CHECK (
    public.is_selling_role()
    AND public.selling_owns_deal(customer_id, created_by)
  );

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
          OR (public.is_selling_role() AND public.selling_owns_deal(i.customer_id, i.created_by))
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
          OR (public.is_selling_role() AND public.selling_owns_deal(i.customer_id, i.created_by))
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
          OR (public.is_selling_role() AND public.selling_owns_deal(i.customer_id, i.created_by))
        )
    )
  );

DROP POLICY IF EXISTS "invoice_items_delete_parent" ON public.invoice_items;
CREATE POLICY "invoice_items_delete_parent" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.is_admin_user()
          OR public.has_role('manager')
          OR public.has_role('accounts')
          OR (public.is_selling_role() AND public.selling_owns_deal(i.customer_id, i.created_by))
        )
    )
  );

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND (
        public.selling_owns_deal(customer_id, created_by)
        OR (
          customer_id IS NULL
          AND (
            sales_agent_id = auth.uid()
            OR (
              vehicle_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.vehicles v
                WHERE v.id = payments.vehicle_id
                  AND (
                    v.reserved_by = auth.uid()
                    OR (
                      v.customer_id IS NOT NULL
                      AND public.sales_owns_customer(v.customer_id)
                    )
                  )
              )
            )
          )
        )
      )
    )
  );
