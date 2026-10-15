-- Consignee shipping fields: email + phone both compulsory and unique;
-- address_line1 required for shipping. Uniqueness indexes are idempotent
-- (also created in 014_customer_contact_uniqueness).

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON public.customers (lower(btrim(email)))
  WHERE nullif(btrim(email), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers (regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE nullif(btrim(phone), '') IS NOT NULL
    AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_require_email_or_phone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_require_email_and_phone'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_require_email_and_phone
      CHECK (
        nullif(btrim(email), '') IS NOT NULL
        AND nullif(btrim(phone), '') IS NOT NULL
      )
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_require_shipping_address'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_require_shipping_address
      CHECK (nullif(btrim(address_line1), '') IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

-- Enforce on new/updated rows immediately; leave NOT VALID if legacy rows are incomplete.
DO $$
BEGIN
  ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_email_and_phone;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'customers_require_email_and_phone left NOT VALID — complete email/phone on existing customers';
END $$;

DO $$
BEGIN
  ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_shipping_address;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'customers_require_shipping_address left NOT VALID — complete address_line1 on existing customers';
END $$;
