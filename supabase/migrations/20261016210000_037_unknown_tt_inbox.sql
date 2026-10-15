/*
# Unknown TT inbox

Bank remittances sometimes arrive before customer/agent are known.
Accounts/ops can park them as unknown (no customer), then tag Customer + Agent later.
Cannot allocate to stock until tagged.
*/

-- ---------------------------------------------------------------------------
-- Column + backfill
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_unknown boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payments.is_unknown IS
  'True when remittance is held in Unknown TT inbox (customer/agent not yet tagged).';

UPDATE public.payments
SET is_unknown = true
WHERE customer_id IS NULL
  AND COALESCE(is_unknown, false) = false
  AND allocation_status = 'unallocated';

CREATE INDEX IF NOT EXISTS payments_is_unknown_idx
  ON public.payments (is_unknown)
  WHERE is_unknown = true;

-- Keep flag consistent with customer tagging.
CREATE OR REPLACE FUNCTION public.payments_set_sales_agent_from_customer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  agent uuid;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    NEW.is_unknown := false;
    -- Prefer an explicit sales_agent_id (tag flow); otherwise derive from customer owner.
    IF NEW.sales_agent_id IS NULL THEN
      SELECT COALESCE(c.assigned_to, c.created_by)
      INTO agent
      FROM public.customers c
      WHERE c.id = NEW.customer_id;
      NEW.sales_agent_id := agent;
    END IF;
  ELSIF COALESCE(NEW.is_unknown, false) THEN
    -- Unknown inbox: no customer/agent until tagged.
    NEW.sales_agent_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_set_sales_agent ON public.payments;
CREATE TRIGGER payments_set_sales_agent
  BEFORE INSERT OR UPDATE OF customer_id, sales_agent_id, is_unknown ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_set_sales_agent_from_customer();

-- ---------------------------------------------------------------------------
-- Block stock allocation until customer is tagged
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_allocations_require_tagged_customer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pay public.payments%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE id = NEW.payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for allocation';
  END IF;
  IF pay.customer_id IS NULL OR COALESCE(pay.is_unknown, false) THEN
    RAISE EXCEPTION 'Cannot allocate Unknown TT until customer and agent are tagged';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_allocations_require_tagged ON public.payment_allocations;
CREATE TRIGGER payment_allocations_require_tagged
  BEFORE INSERT OR UPDATE OF payment_id ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_allocations_require_tagged_customer();

REVOKE ALL ON FUNCTION public.payment_allocations_require_tagged_customer() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: unknown rows visible to elevated + auditor only until tagged
-- (selling roles already need customer ownership or sales_agent_id)
-- Insert unknown only via elevated staff (existing insert policy allows null customer for elevated).
-- ---------------------------------------------------------------------------

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

DROP POLICY IF EXISTS "payments_insert_ops" ON public.payments;
CREATE POLICY "payments_insert_ops" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (
        public.is_elevated_staff()
        AND (
          COALESCE(is_unknown, false) = false
          OR (COALESCE(is_unknown, false) = true AND customer_id IS NULL)
        )
      )
      OR (
        public.is_selling_role()
        AND COALESCE(is_unknown, false) = false
        AND customer_id IS NOT NULL
        AND public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "payment_allocations_insert" ON public.payment_allocations;
CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND p.customer_id IS NOT NULL
        AND COALESCE(p.is_unknown, false) = false
        AND (
          public.is_elevated_staff()
          OR (
            public.is_selling_role()
            AND public.selling_owns_deal(p.customer_id, p.created_by)
          )
        )
    )
  );
