/*
# Vehicle freight mode (RORO vs container)

Nullable until set on reserve / stock edit. Sales reservation updates
are allowed to write this column (not listed in vehicles_enforce_sales_update
blocked fields).
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS freight_mode text;

DO $$
BEGIN
  ALTER TABLE public.vehicles
    DROP CONSTRAINT IF EXISTS vehicles_freight_mode_check;
  ALTER TABLE public.vehicles
    ADD CONSTRAINT vehicles_freight_mode_check
    CHECK (freight_mode IS NULL OR freight_mode IN ('roro', 'container'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.vehicles.freight_mode IS
  'Export freight mode: roro or container. Null until reservation/edit sets it.';
