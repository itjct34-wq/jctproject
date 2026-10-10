-- Customer records must have at least one contact method.
-- Email uniqueness is case-insensitive; phone uniqueness ignores formatting characters.
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON public.customers (lower(btrim(email)))
  WHERE nullif(btrim(email), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers (regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE nullif(btrim(phone), '') IS NOT NULL
    AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_require_email_or_phone'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_require_email_or_phone
      CHECK (nullif(btrim(email), '') IS NOT NULL OR nullif(btrim(phone), '') IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.customers VALIDATE CONSTRAINT customers_require_email_or_phone;
