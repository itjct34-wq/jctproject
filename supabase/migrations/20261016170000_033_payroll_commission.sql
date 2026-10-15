/*
# Payroll salaries + vehicle commission (PKR)

- user_payroll: monthly salary per profile (amount + currency, default PKR).
  Admin/manager write; sales/freelancer cannot edit salaries.
- vehicles.commission_pkr + commission_status none|due|paid.
  DUE when payment_status is paid OR shipping_status is delivered (and amount > 0).
  Only admin/manager/accounts may mark paid.
*/

-- ---------------------------------------------------------------------------
-- Salaries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_payroll (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  salary_amount numeric(14,2) NOT NULL DEFAULT 0,
  salary_currency text NOT NULL DEFAULT 'PKR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

DO $$
BEGIN
  ALTER TABLE public.user_payroll
    DROP CONSTRAINT IF EXISTS user_payroll_salary_currency_check;
  ALTER TABLE public.user_payroll
    ADD CONSTRAINT user_payroll_salary_currency_check
    CHECK (salary_currency ~ '^[A-Z]{3}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.user_payroll IS
  'Simple monthly salary per user. Not a full payroll/HR product.';

ALTER TABLE public.user_payroll ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payroll TO authenticated;

DROP POLICY IF EXISTS "user_payroll_select" ON public.user_payroll;
CREATE POLICY "user_payroll_select"
  ON public.user_payroll FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('auditor')
  );

DROP POLICY IF EXISTS "user_payroll_write" ON public.user_payroll;
CREATE POLICY "user_payroll_write"
  ON public.user_payroll FOR ALL TO authenticated
  USING (public.is_admin_user() OR public.has_role('manager'))
  WITH CHECK (public.is_admin_user() OR public.has_role('manager'));

-- ---------------------------------------------------------------------------
-- Commission on vehicles
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS commission_pkr numeric(14,2),
  ADD COLUMN IF NOT EXISTS commission_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS commission_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.vehicles
    DROP CONSTRAINT IF EXISTS vehicles_commission_status_check;
  ALTER TABLE public.vehicles
    ADD CONSTRAINT vehicles_commission_status_check
    CHECK (commission_status IN ('none', 'due', 'paid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.vehicles.commission_pkr IS
  'Selling-agent commission in PKR. Staff enter the amount; no invented FX.';
COMMENT ON COLUMN public.vehicles.commission_status IS
  'none until paid or delivered; due when either happens and amount > 0; paid when finance marks it.';

CREATE INDEX IF NOT EXISTS idx_vehicles_commission_status
  ON public.vehicles (commission_status)
  WHERE commission_status IN ('due', 'paid');

REVOKE SELECT (
  commission_pkr,
  commission_status,
  commission_paid_at,
  commission_paid_by
) ON public.vehicles FROM anon, public;

CREATE OR REPLACE FUNCTION public.vehicles_apply_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_status IS NULL OR NEW.commission_status = '' THEN
    NEW.commission_status := 'none';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.commission_status = 'paid'
     AND OLD.commission_status IS DISTINCT FROM 'paid' THEN
    IF NOT (
      public.is_admin_user()
      OR public.has_role('manager')
      OR public.has_role('accounts')
    ) THEN
      RAISE EXCEPTION 'Only admin, manager, or accounts can mark commission paid';
    END IF;
    NEW.commission_paid_at := COALESCE(NEW.commission_paid_at, now());
    NEW.commission_paid_by := COALESCE(NEW.commission_paid_by, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.commission_status = 'paid' THEN
    RETURN NEW;
  END IF;

  NEW.commission_paid_at := NULL;
  NEW.commission_paid_by := NULL;

  IF COALESCE(NEW.commission_pkr, 0) > 0
     AND (
       NEW.payment_status = 'paid'
       OR NEW.shipping_status = 'delivered'
     ) THEN
    NEW.commission_status := 'due';
  ELSE
    NEW.commission_status := 'none';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_apply_commission_status ON public.vehicles;
CREATE TRIGGER vehicles_apply_commission_status
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.vehicles_apply_commission_status();

CREATE OR REPLACE FUNCTION public.vehicles_enforce_sales_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_user()
    OR public.has_role('operations')
    OR public.has_role('manager')
    OR public.has_role('accounts')
  THEN
    RETURN NEW;
  END IF;

  IF public.has_role('sales_agent') OR public.has_role('freelancer') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.stock_number IS DISTINCT FROM OLD.stock_number
      OR NEW.chassis_number IS DISTINCT FROM OLD.chassis_number
      OR NEW.make IS DISTINCT FROM OLD.make
      OR NEW.model IS DISTINCT FROM OLD.model
      OR NEW.listed_price IS DISTINCT FROM OLD.listed_price
      OR NEW.purchase_price IS DISTINCT FROM OLD.purchase_price
      OR NEW.expense_jpy IS DISTINCT FROM OLD.expense_jpy
      OR NEW.tt_rate IS DISTINCT FROM OLD.tt_rate
      OR NEW.fob_usd IS DISTINCT FROM OLD.fob_usd
      OR NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
      OR NEW.shipping_port_of_loading IS DISTINCT FROM OLD.shipping_port_of_loading
      OR NEW.shipping_port_of_discharge IS DISTINCT FROM OLD.shipping_port_of_discharge
      OR NEW.shipping_vessel_name IS DISTINCT FROM OLD.shipping_vessel_name
      OR NEW.shipping_bl_number IS DISTINCT FROM OLD.shipping_bl_number
      OR NEW.shipping_line IS DISTINCT FROM OLD.shipping_line
      OR NEW.shipping_etd IS DISTINCT FROM OLD.shipping_etd
      OR NEW.shipping_eta IS DISTINCT FROM OLD.shipping_eta
      OR NEW.shipping_notes IS DISTINCT FROM OLD.shipping_notes
      OR NEW.commission_status = 'paid'
      OR NEW.commission_paid_at IS DISTINCT FROM OLD.commission_paid_at
      OR NEW.commission_paid_by IS DISTINCT FROM OLD.commission_paid_by
    THEN
      RAISE EXCEPTION 'Sales users may only reserve vehicles (customer, sold price, term, and commission amount)';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.vehicles
SET commission_status = commission_status
WHERE COALESCE(commission_pkr, 0) > 0
  AND commission_status IS DISTINCT FROM 'paid'
  AND (payment_status = 'paid' OR shipping_status = 'delivered');
