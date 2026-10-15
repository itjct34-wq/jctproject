/*
# 035 Office expenses + payroll salary postings

- expenses.office_id: bills belong to an office
- expenses.payroll_user_id + payroll_period: monthly salary line from user_payroll
- Unique one paid salary per user per YYYY-MM
- RLS: operations can read office bills they may insert; selling roles with an office
  may insert/select only their own office-tagged rows
*/

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payroll_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payroll_period text;

DO $$
BEGIN
  ALTER TABLE public.expenses
    DROP CONSTRAINT IF EXISTS expenses_payroll_period_check;
  ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_payroll_period_check
    CHECK (payroll_period IS NULL OR payroll_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.expenses.office_id IS
  'Office this bill belongs to. Required in the Accounts UI.';
COMMENT ON COLUMN public.expenses.payroll_user_id IS
  'Set when this row is a posted monthly salary from user_payroll.';
COMMENT ON COLUMN public.expenses.payroll_period IS
  'YYYY-MM period for a payroll salary posting.';

CREATE INDEX IF NOT EXISTS expenses_office_id_idx ON public.expenses (office_id);
CREATE INDEX IF NOT EXISTS expenses_payroll_user_id_idx ON public.expenses (payroll_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_payroll_user_period_uidx
  ON public.expenses (payroll_user_id, payroll_period)
  WHERE payroll_user_id IS NOT NULL AND payroll_period IS NOT NULL;

DROP POLICY IF EXISTS "expenses_select_ops" ON public.expenses;
CREATE POLICY "expenses_select_ops" ON public.expenses FOR SELECT TO authenticated
USING (
  public.is_admin_user()
  OR public.has_role('manager')
  OR public.has_role('accounts')
  OR public.has_role('auditor')
  OR public.has_role('operations')
  OR (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "expenses_insert_ops" ON public.expenses;
CREATE POLICY "expenses_insert_ops" ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_admin_user()
    OR public.has_role('manager')
    OR public.has_role('accounts')
    OR public.has_role('operations')
    OR (
      (public.has_role('sales_agent') OR public.has_role('freelancer'))
      AND office_id IS NOT NULL
      AND office_id = (SELECT p.office_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "expenses_update_ops" ON public.expenses;
CREATE POLICY "expenses_update_ops" ON public.expenses FOR UPDATE TO authenticated
USING (
  public.is_admin_user()
  OR public.has_role('manager')
  OR public.has_role('accounts')
  OR (
    public.has_role('operations')
    AND created_by = auth.uid()
  )
  OR (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND created_by = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user()
  OR public.has_role('manager')
  OR public.has_role('accounts')
  OR (
    public.has_role('operations')
    AND created_by = auth.uid()
  )
  OR (
    (public.has_role('sales_agent') OR public.has_role('freelancer'))
    AND created_by = auth.uid()
    AND office_id IS NOT NULL
    AND office_id = (SELECT p.office_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);
