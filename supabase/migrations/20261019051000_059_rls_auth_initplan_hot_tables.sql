/*
  RLS auth_rls_initplan cleanup for hot tables (vehicles, profiles + payments/invoices inserts).

  HOW: Postgres re-plans policies per row when auth.uid() is called as a volatile
  function. Wrapping as (select auth.uid()) makes it an InitPlan — evaluated once
  per query. Semantics unchanged; only planning cost changes.

  Permissive multi-policy UPDATE on vehicles/profiles (staff vs own/sales) is
  intentional OR composition — not collapsed here.
*/

-- profiles ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user() OR ((select auth.uid()) = id));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- vehicles ---------------------------------------------------------------
DROP POLICY IF EXISTS "vehicles_insert_operations" ON public.vehicles;
CREATE POLICY "vehicles_insert_operations"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = (select auth.uid()))
    AND (is_admin_user() OR has_role('operations'::text) OR has_role('manager'::text))
  );

DROP POLICY IF EXISTS "vehicles_update_sales_reserve" ON public.vehicles;
CREATE POLICY "vehicles_update_sales_reserve"
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (
    (has_role('sales_agent'::text) OR has_role('freelancer'::text))
    AND (payment_status = 'available'::text)
    AND (reserved_by IS NULL)
  )
  WITH CHECK (
    (has_role('sales_agent'::text) OR has_role('freelancer'::text))
    AND (payment_status = 'reserved'::text)
    AND (customer_id IS NOT NULL)
    AND (reserved_by = (select auth.uid()))
    AND customer_owned_by_agent(customer_id, (select auth.uid()))
  );

-- payments (hot path; same initplan pattern) -----------------------------
DROP POLICY IF EXISTS "payments_insert_ops" ON public.payments;
CREATE POLICY "payments_insert_ops"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = (select auth.uid()))
    AND has_permission('payments'::text, 'create'::text)
  );

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    is_elevated_staff()
    OR has_role('auditor'::text)
    OR (
      is_selling_role()
      AND (COALESCE(is_unknown, false) = false)
      AND (
        selling_owns_deal(customer_id, created_by)
        OR (sales_agent_id = (select auth.uid()))
        OR (
          (customer_id IS NULL)
          AND (vehicle_id IS NOT NULL)
          AND (
            EXISTS (
              SELECT 1
              FROM public.vehicles v
              WHERE v.id = payments.vehicle_id
                AND (
                  v.reserved_by = (select auth.uid())
                  OR (
                    v.customer_id IS NOT NULL
                    AND sales_owns_customer(v.customer_id)
                  )
                )
            )
          )
        )
      )
    )
  );

-- invoices ---------------------------------------------------------------
DROP POLICY IF EXISTS "invoices_insert_ops" ON public.invoices;
CREATE POLICY "invoices_insert_ops"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = (select auth.uid()))
    AND (
      is_admin_user()
      OR has_role('manager'::text)
      OR has_role('accounts'::text)
      OR has_role('sales_agent'::text)
      OR has_role('freelancer'::text)
    )
  );
