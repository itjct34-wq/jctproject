/*
# Sales agent & freelancer: own-records visibility (RLS)

Selling roles (sales_agent, freelancer) may only read:
- customers they created (created_by) or are assigned to (assigned_to)
- inquiries assigned to them (plus unassigned, so they can claim)
- quotations / invoices / sales they created OR whose customer is in their set
- payments tagged to them, their customers, or their reserved vehicles
- vehicles that are available to reserve, plus units they reserved (or reserved for their customers)

Elevated staff (super_admin, admin, operations, manager, accounts) keep full visibility.
Auditor keeps existing read-all on these tables.
Auction deposit invoices share public.invoices (no separate table).
*/

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_elevated_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND r.name IN ('super_admin', 'admin', 'operations', 'manager', 'accounts')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_selling_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND r.name IN ('sales_agent', 'freelancer')
  );
$$;

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
      AND (c.assigned_to = p_user_id OR c.created_by = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.sales_owns_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.customer_owned_by_agent(p_customer_id, auth.uid());
$$;

-- Available catalog + own reserved / customer units + own sale rows.
CREATE OR REPLACE FUNCTION public.can_view_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = p_vehicle_id
        AND public.is_selling_role()
        AND (
          v.payment_status = 'available'
          OR v.reserved_by = auth.uid()
          OR (
            v.customer_id IS NOT NULL
            AND public.customer_owned_by_agent(v.customer_id, auth.uid())
          )
          OR EXISTS (
            SELECT 1
            FROM public.sales s
            WHERE s.vehicle_id = v.id
              AND (
                s.created_by = auth.uid()
                OR public.customer_owned_by_agent(s.customer_id, auth.uid())
              )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_elevated_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_selling_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_owned_by_agent(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sales_owns_customer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_vehicle(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_elevated_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_selling_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_owned_by_agent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_owns_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_vehicle(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Customers (+ child rows)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customers_select_assigned_or_admin" ON public.customers;
CREATE POLICY "customers_select_assigned_or_admin" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
CREATE POLICY "customers_insert_authenticated" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_elevated_staff()
      OR assigned_to IS NULL
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_update_assigned_or_admin" ON public.customers;
CREATE POLICY "customers_update_assigned_or_admin" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.is_elevated_staff()
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_elevated_staff()
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "customer_contacts_select_parent_access" ON public.customer_contacts;
CREATE POLICY "customer_contacts_select_parent_access" ON public.customer_contacts
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR public.sales_owns_customer(customer_id)
  );

DROP POLICY IF EXISTS "customer_contacts_insert_parent_access" ON public.customer_contacts;
CREATE POLICY "customer_contacts_insert_parent_access" ON public.customer_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_elevated_staff()
    OR public.sales_owns_customer(customer_id)
  );

DROP POLICY IF EXISTS "customer_contacts_update_parent_access" ON public.customer_contacts;
CREATE POLICY "customer_contacts_update_parent_access" ON public.customer_contacts
  FOR UPDATE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id))
  WITH CHECK (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

DROP POLICY IF EXISTS "customer_contacts_delete_parent_access" ON public.customer_contacts;
CREATE POLICY "customer_contacts_delete_parent_access" ON public.customer_contacts
  FOR DELETE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

DROP POLICY IF EXISTS "customer_requirements_select_parent_access" ON public.customer_requirements;
CREATE POLICY "customer_requirements_select_parent_access" ON public.customer_requirements
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR public.sales_owns_customer(customer_id)
  );

DROP POLICY IF EXISTS "customer_requirements_insert_parent_access" ON public.customer_requirements;
CREATE POLICY "customer_requirements_insert_parent_access" ON public.customer_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_elevated_staff() OR public.sales_owns_customer(customer_id))
  );

DROP POLICY IF EXISTS "customer_requirements_update_parent_access" ON public.customer_requirements;
CREATE POLICY "customer_requirements_update_parent_access" ON public.customer_requirements
  FOR UPDATE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id))
  WITH CHECK (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

DROP POLICY IF EXISTS "customer_requirements_delete_parent_access" ON public.customer_requirements;
CREATE POLICY "customer_requirements_delete_parent_access" ON public.customer_requirements
  FOR DELETE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

DROP POLICY IF EXISTS "customer_communications_select_parent_access" ON public.customer_communications;
CREATE POLICY "customer_communications_select_parent_access" ON public.customer_communications
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR public.sales_owns_customer(customer_id)
  );

DROP POLICY IF EXISTS "customer_communications_insert_parent_access" ON public.customer_communications;
CREATE POLICY "customer_communications_insert_parent_access" ON public.customer_communications
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_elevated_staff() OR public.sales_owns_customer(customer_id))
  );

DROP POLICY IF EXISTS "customer_communications_update_parent_access" ON public.customer_communications;
CREATE POLICY "customer_communications_update_parent_access" ON public.customer_communications
  FOR UPDATE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id))
  WITH CHECK (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

DROP POLICY IF EXISTS "customer_communications_delete_parent_access" ON public.customer_communications;
CREATE POLICY "customer_communications_delete_parent_access" ON public.customer_communications
  FOR DELETE TO authenticated
  USING (public.is_elevated_staff() OR public.sales_owns_customer(customer_id));

-- ---------------------------------------------------------------------------
-- Inquiries (assigned_to; no created_by)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS inquiries_staff_read ON public.inquiries;
DROP POLICY IF EXISTS inquiries_read ON public.inquiries;
CREATE POLICY inquiries_staff_read ON public.inquiries
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND public.has_permission('customers', 'view')
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
  );

DROP POLICY IF EXISTS inquiries_staff_update ON public.inquiries;
DROP POLICY IF EXISTS inquiries_update ON public.inquiries;
CREATE POLICY inquiries_staff_update ON public.inquiries
  FOR UPDATE TO authenticated
  USING (
    public.is_elevated_staff()
    OR (
      public.is_selling_role()
      AND public.has_permission('customers', 'edit')
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
  )
  WITH CHECK (
    public.is_elevated_staff()
    OR (
      public.is_selling_role()
      AND public.has_permission('customers', 'edit')
      AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
  );

-- ---------------------------------------------------------------------------
-- Quotations / sales (reservations) / invoices (commercial + auction deposit)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "quotations_select_ops" ON public.quotations;
CREATE POLICY "quotations_select_ops" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "quotations_update_ops" ON public.quotations;
CREATE POLICY "quotations_update_ops" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "sales_select_ops" ON public.sales;
CREATE POLICY "sales_select_ops" ON public.sales
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "sales_update_ops" ON public.sales;
CREATE POLICY "sales_update_ops" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "invoices_select_ops" ON public.invoices;
CREATE POLICY "invoices_select_ops" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND (
        created_by = auth.uid()
        OR public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "invoices_update_sales_own" ON public.invoices;
CREATE POLICY "invoices_update_sales_own" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.is_selling_role()
    AND (
      created_by = auth.uid()
      OR public.sales_owns_customer(customer_id)
    )
  )
  WITH CHECK (
    public.is_selling_role()
    AND (
      created_by = auth.uid()
      OR public.sales_owns_customer(customer_id)
    )
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
          OR (
            public.is_selling_role()
            AND (
              i.created_by = auth.uid()
              OR public.sales_owns_customer(i.customer_id)
            )
          )
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
          OR (
            public.is_selling_role()
            AND (
              i.created_by = auth.uid()
              OR public.sales_owns_customer(i.customer_id)
            )
          )
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
          OR (
            public.is_selling_role()
            AND (
              i.created_by = auth.uid()
              OR public.sales_owns_customer(i.customer_id)
            )
          )
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
          OR (
            public.is_selling_role()
            AND (
              i.created_by = auth.uid()
              OR public.sales_owns_customer(i.customer_id)
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND (
        sales_agent_id = auth.uid()
        OR created_by = auth.uid()
        OR (customer_id IS NOT NULL AND public.sales_owns_customer(customer_id))
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
  );

-- ---------------------------------------------------------------------------
-- Vehicles (keep anon public catalog policy)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "vehicles_select_operations" ON public.vehicles;
CREATE POLICY "vehicles_select_operations" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.can_view_vehicle(id));

-- ---------------------------------------------------------------------------
-- Attachments: inherit parent row visibility (not module permission alone)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS record_attachments_select ON public.record_attachments;
CREATE POLICY record_attachments_select
  ON public.record_attachments FOR SELECT TO authenticated
  USING (
    CASE entity_type
      WHEN 'invoices' THEN
        public.has_permission('invoices', 'view')
        AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = entity_id)
      WHEN 'quotations' THEN
        public.has_permission('sales', 'view')
        AND EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = entity_id)
      WHEN 'payments' THEN
        public.has_permission('payments', 'view')
        AND EXISTS (SELECT 1 FROM public.payments p WHERE p.id = entity_id)
      WHEN 'expenses' THEN public.has_permission('expenses', 'view')
      WHEN 'documents' THEN public.has_permission('documents', 'view')
      WHEN 'vehicles' THEN public.can_view_vehicle(entity_id)
      ELSE false
    END
  );

-- ---------------------------------------------------------------------------
-- Ops override: explicit shipping_status on UPDATE is not overwritten by auto-book
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vehicles_apply_shipping_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.shipping_status IS DISTINCT FROM OLD.shipping_status THEN
    RETURN NEW;
  END IF;

  IF NEW.shipping_status IN ('shipped', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM 'available'
     AND NEW.customer_id IS NOT NULL
     AND (
       COALESCE(NEW.shipping_port_of_loading, '') <> ''
       OR COALESCE(NEW.shipping_port_of_discharge, '') <> ''
       OR COALESCE(NEW.shipping_vessel_name, '') <> ''
       OR COALESCE(NEW.shipping_bl_number, '') <> ''
       OR COALESCE(NEW.shipping_line, '') <> ''
       OR NEW.shipping_etd IS NOT NULL
       OR NEW.shipping_eta IS NOT NULL
     )
  THEN
    NEW.shipping_status := 'booked';
  END IF;

  RETURN NEW;
END;
$$;
