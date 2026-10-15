/*
# Unknown TT — tagged agent visibility

Ensure selling roles can SELECT remittances tagged to them via sales_agent_id
(even when that agent is not the customer's assignee). Unknown inbox rows stay
hidden from sales until tagged (is_unknown = false).
*/

DROP POLICY IF EXISTS "payments_select_ops" ON public.payments;
CREATE POLICY "payments_select_ops" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_elevated_staff()
    OR public.has_role('auditor')
    OR (
      public.is_selling_role()
      AND COALESCE(is_unknown, false) = false
      AND (
        public.selling_owns_deal(customer_id, created_by)
        OR sales_agent_id = auth.uid()
        OR (
          customer_id IS NULL
          AND vehicle_id IS NOT NULL
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
