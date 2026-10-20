-- Invoice (and other) consignees need phone OR email — not both compulsory.
-- Keep archive exemption so incomplete legacy rows can still be inactivated.

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_require_email_and_phone;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_require_email_or_phone;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_require_email_or_phone
  CHECK (
    status IN ('inactive', 'blocked')
    OR (
      nullif(btrim(email), '') IS NOT NULL
      OR nullif(btrim(phone), '') IS NOT NULL
    )
  )
  NOT VALID;

DO $$
BEGIN
  ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_email_or_phone;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'customers_require_email_or_phone left NOT VALID — complete or archive incomplete customers';
END $$;
