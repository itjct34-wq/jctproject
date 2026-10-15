/*
# 034 Remittance management

- Extra remittance fields on payments (office/shift, remitter/bank, instructed/remit/charges, dates)
- payment_allocations: split a T/T across stock units
- Remaining = remit_amount - SUM(allocations); remaining 0 → allocated
- Recompute vehicle payment_status (partial_paid / paid) from allocation totals
- Sales/freelancer: create/edit/allocate own-customer remittances; cannot delete
*/

-- ---------------------------------------------------------------------------
-- Payments: remittance columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remitter_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_address text,
  ADD COLUMN IF NOT EXISTS bank_phone text,
  ADD COLUMN IF NOT EXISTS instructed_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS remit_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS bank_charges numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remit_date date,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS allocation_status text NOT NULL DEFAULT 'unallocated';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_allocation_status_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_allocation_status_check
      CHECK (allocation_status IN ('unallocated', 'allocated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_office_id_idx ON public.payments (office_id);
CREATE INDEX IF NOT EXISTS payments_allocation_status_idx ON public.payments (allocation_status);
CREATE INDEX IF NOT EXISTS payments_remit_date_idx ON public.payments (remit_date);

UPDATE public.payments
SET
  remit_amount = COALESCE(remit_amount, amount),
  instructed_amount = COALESCE(instructed_amount, amount),
  remit_date = COALESCE(remit_date, payment_date),
  received_date = COALESCE(received_date, CASE WHEN status IN ('received', 'reconciled') THEN payment_date ELSE NULL END),
  bank_charges = COALESCE(NULLIF(bank_charges, 0), GREATEST(COALESCE(instructed_amount, amount) - COALESCE(remit_amount, amount), 0)),
  payment_method = COALESCE(payment_method, 'bank_transfer');

-- ---------------------------------------------------------------------------
-- Allocations (multi-stock)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  allocate_amount numeric(14,2) NOT NULL CHECK (allocate_amount > 0),
  sold_price numeric(14,2),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_id_idx ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_vehicle_id_idx ON public.payment_allocations (vehicle_id);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

INSERT INTO public.payment_allocations (payment_id, vehicle_id, allocate_amount, sold_price, created_by)
SELECT
  p.id,
  p.vehicle_id,
  GREATEST(COALESCE(p.remit_amount, p.amount), 0.01),
  COALESCE(v.sold_price, v.fob_usd, v.listed_price),
  p.created_by
FROM public.payments p
JOIN public.vehicles v ON v.id = p.vehicle_id
WHERE p.vehicle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_allocations a
    WHERE a.payment_id = p.id AND a.vehicle_id = p.vehicle_id
  );

-- ---------------------------------------------------------------------------
-- Remittance remaining / allocation_status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_allocated_total(p_payment_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(a.allocate_amount), 0)
  FROM public.payment_allocations a
  WHERE a.payment_id = p_payment_id;
$$;

CREATE OR REPLACE FUNCTION public.recompute_payment_allocation_status(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remit numeric;
  allocated numeric;
  first_vehicle uuid;
BEGIN
  IF p_payment_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(remit_amount, amount, 0)
  INTO remit
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF remit IS NULL THEN
    RETURN;
  END IF;

  allocated := public.payment_allocated_total(p_payment_id);

  IF allocated > remit + 0.009 THEN
    RAISE EXCEPTION 'Allocation exceeds remittance remaining (allocated %, remit %)', allocated, remit;
  END IF;

  SELECT a.vehicle_id
  INTO first_vehicle
  FROM public.payment_allocations a
  WHERE a.payment_id = p_payment_id
  ORDER BY a.created_at
  LIMIT 1;

  UPDATE public.payments
  SET
    allocation_status = CASE WHEN remit - allocated <= 0.009 THEN 'allocated' ELSE 'unallocated' END,
    vehicle_id = first_vehicle,
    updated_at = now()
  WHERE id = p_payment_id
    AND (
      allocation_status IS DISTINCT FROM CASE WHEN remit - allocated <= 0.009 THEN 'allocated' ELSE 'unallocated' END
      OR vehicle_id IS DISTINCT FROM first_vehicle
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_sync_remittance_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.remit_amount := COALESCE(NEW.remit_amount, NEW.amount);
  NEW.instructed_amount := COALESCE(NEW.instructed_amount, NEW.remit_amount, NEW.amount);
  NEW.amount := COALESCE(NEW.remit_amount, NEW.amount);
  NEW.exchange_rate := COALESCE(NEW.exchange_rate, 1);
  NEW.amount_jpy := ROUND(NEW.amount * NEW.exchange_rate, 2);
  NEW.bank_charges := GREATEST(COALESCE(NEW.instructed_amount, NEW.amount) - COALESCE(NEW.remit_amount, NEW.amount), 0);
  NEW.remit_date := COALESCE(NEW.remit_date, NEW.payment_date);
  NEW.payment_date := COALESCE(NEW.remit_date, NEW.payment_date);
  IF NEW.received_date IS NOT NULL AND NEW.status = 'pending' THEN
    NEW.status := 'received';
  END IF;
  IF NEW.payment_method IS NULL THEN
    NEW.payment_method := 'bank_transfer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_remittance_amounts ON public.payments;
CREATE TRIGGER payments_sync_remittance_amounts
  BEFORE INSERT OR UPDATE OF amount, remit_amount, instructed_amount, exchange_rate, remit_date, received_date, payment_date
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_sync_remittance_amounts();

-- ---------------------------------------------------------------------------
-- Vehicle payment_status from allocations (partial / paid)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recompute_vehicle_payment_status(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listed numeric;
  paid numeric;
  cur_status text;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    payment_status,
    COALESCE(sold_price, fob_usd, listed_price)
  INTO cur_status, listed
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(a.allocate_amount), 0)
  INTO paid
  FROM public.payment_allocations a
  JOIN public.payments p ON p.id = a.payment_id
  WHERE a.vehicle_id = p_vehicle_id
    AND p.status IN ('pending', 'received', 'reconciled');

  -- Legacy single-vehicle payments with no allocation row yet
  IF paid = 0 THEN
    SELECT COALESCE(SUM(p.amount), 0)
    INTO paid
    FROM public.payments p
    WHERE p.vehicle_id = p_vehicle_id
      AND p.status IN ('pending', 'received', 'reconciled')
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_allocations a WHERE a.payment_id = p.id
      );
  END IF;

  IF paid <= 0 THEN
    IF cur_status IN ('partial_paid', 'paid') THEN
      UPDATE public.vehicles SET payment_status = 'reserved', updated_at = now()
      WHERE id = p_vehicle_id AND payment_status IN ('partial_paid', 'paid');
    END IF;
    RETURN;
  END IF;

  IF listed IS NOT NULL AND listed > 0 AND paid >= listed THEN
    UPDATE public.vehicles SET payment_status = 'paid', updated_at = now()
    WHERE id = p_vehicle_id;
  ELSE
    UPDATE public.vehicles SET payment_status = 'partial_paid', updated_at = now()
    WHERE id = p_vehicle_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_allocations_link_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.payments%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE id = NEW.payment_id;
  IF pay.id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.vehicles v
  SET
    customer_id = COALESCE(v.customer_id, pay.customer_id),
    reserved_by = COALESCE(v.reserved_by, pay.sales_agent_id, pay.created_by),
    payment_status = CASE WHEN v.payment_status = 'available' THEN 'reserved' ELSE v.payment_status END,
    updated_at = now()
  WHERE v.id = NEW.vehicle_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_allocations_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_payment_allocation_status(OLD.payment_id);
    PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_payment_allocation_status(NEW.payment_id);
  PERFORM public.recompute_vehicle_payment_status(NEW.vehicle_id);

  IF TG_OP = 'UPDATE' AND OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_allocations_link_vehicle ON public.payment_allocations;
CREATE TRIGGER payment_allocations_link_vehicle
  BEFORE INSERT OR UPDATE OF vehicle_id ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_allocations_link_vehicle();

DROP TRIGGER IF EXISTS payment_allocations_after_change ON public.payment_allocations;
CREATE TRIGGER payment_allocations_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_allocations_after_change();

CREATE OR REPLACE FUNCTION public.payments_after_change_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.vehicle_id IS NOT NULL THEN
    INSERT INTO public.payment_allocations (payment_id, vehicle_id, allocate_amount, sold_price, created_by)
    SELECT
      NEW.id,
      NEW.vehicle_id,
      GREATEST(COALESCE(NEW.remit_amount, NEW.amount), 0.01),
      COALESCE(v.sold_price, v.fob_usd, v.listed_price),
      NEW.created_by
    FROM public.vehicles v
    WHERE v.id = NEW.vehicle_id
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_allocations a WHERE a.payment_id = NEW.id
      );
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
      PERFORM public.recompute_vehicle_payment_status(OLD.vehicle_id);
    END IF;
    PERFORM public.recompute_payment_allocation_status(NEW.id);
  END IF;

  IF NEW.vehicle_id IS NOT NULL THEN
    PERFORM public.recompute_vehicle_payment_status(NEW.vehicle_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_after_change_vehicle ON public.payments;
CREATE TRIGGER payments_after_change_vehicle
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_after_change_vehicle();

UPDATE public.payments p
SET allocation_status = CASE
  WHEN COALESCE(p.remit_amount, p.amount, 0) - public.payment_allocated_total(p.id) <= 0.009
    AND public.payment_allocated_total(p.id) > 0
  THEN 'allocated'
  ELSE 'unallocated'
END;

-- ---------------------------------------------------------------------------
-- Permissions: sales create/edit remittances (not delete)
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (module, action, description)
VALUES ('payments', 'delete', 'Delete remittances')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('sales_agent', 'freelancer', 'manager')
  AND p.module = 'payments'
  AND p.action IN ('create', 'edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'freelancer'
  AND p.module = 'payments'
  AND p.action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('admin', 'manager', 'accounts')
  AND p.module = 'payments'
  AND p.action = 'delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "payments_insert_ops" ON public.payments;
CREATE POLICY "payments_insert_ops" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_elevated_staff()
      OR (
        public.is_selling_role()
        AND customer_id IS NOT NULL
        AND public.sales_owns_customer(customer_id)
      )
    )
  );

DROP POLICY IF EXISTS "payments_update_ops" ON public.payments;
CREATE POLICY "payments_update_ops" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.is_elevated_staff()
    OR (
      public.is_selling_role()
      AND public.selling_owns_deal(customer_id, created_by)
    )
  )
  WITH CHECK (
    public.is_elevated_staff()
    OR (
      public.is_selling_role()
      AND public.selling_owns_deal(customer_id, created_by)
    )
  );

DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;
CREATE POLICY "payments_delete_admin" ON public.payments
  FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('accounts')
  );

DROP POLICY IF EXISTS "payment_allocations_select" ON public.payment_allocations;
CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id)
  );

DROP POLICY IF EXISTS "payment_allocations_insert" ON public.payment_allocations;
CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND (
          public.is_elevated_staff()
          OR (
            public.is_selling_role()
            AND public.selling_owns_deal(p.customer_id, p.created_by)
          )
        )
    )
  );

DROP POLICY IF EXISTS "payment_allocations_update" ON public.payment_allocations;
CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND (
          public.is_elevated_staff()
          OR (
            public.is_selling_role()
            AND public.selling_owns_deal(p.customer_id, p.created_by)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND (
          public.is_elevated_staff()
          OR (
            public.is_selling_role()
            AND public.selling_owns_deal(p.customer_id, p.created_by)
          )
        )
    )
  );

DROP POLICY IF EXISTS "payment_allocations_delete" ON public.payment_allocations;
CREATE POLICY "payment_allocations_delete" ON public.payment_allocations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id
        AND (
          public.is_elevated_staff()
          OR (
            public.is_selling_role()
            AND public.selling_owns_deal(p.customer_id, p.created_by)
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT EXECUTE ON FUNCTION public.payment_allocated_total(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.recompute_payment_allocation_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_vehicle_payment_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_allocated_total(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.payment_allocations_after_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_allocations_link_vehicle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_after_change_vehicle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payments_sync_remittance_amounts() FROM PUBLIC, anon, authenticated;
