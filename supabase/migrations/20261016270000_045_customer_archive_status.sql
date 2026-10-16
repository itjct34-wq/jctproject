-- Allow archiving (status → inactive/blocked) without re-validating consignee
-- fields. NOT VALID CHECKs still apply on every UPDATE of the row, so incomplete
-- legacy customers could not be archived at all.
-- Also tighten customer UPDATE WITH CHECK so owners can update unassigned rows
-- while elevated staff keep full access and assignees can still hand off
-- (assigned_to may change to another user).

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_require_email_and_phone;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_require_shipping_address;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_require_email_and_phone
  CHECK (
    status IN ('inactive', 'blocked')
    OR (
      nullif(btrim(email), '') IS NOT NULL
      AND nullif(btrim(phone), '') IS NOT NULL
    )
  )
  NOT VALID;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_require_shipping_address
  CHECK (
    status IN ('inactive', 'blocked')
    OR nullif(btrim(address_line1), '') IS NOT NULL
  )
  NOT VALID;

DO $$
BEGIN
  ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_email_and_phone;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'customers_require_email_and_phone left NOT VALID — complete or archive incomplete customers';
END $$;

DO $$
BEGIN
  ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_shipping_address;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'customers_require_shipping_address left NOT VALID — complete or archive incomplete customers';
END $$;

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
    OR (assigned_to IS NULL AND created_by = auth.uid())
  );
