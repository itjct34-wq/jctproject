/*
  Procurement source for vehicles: own stock vs auction-sourced vs third-party
  dealership once-price units (ERP-only; not public inventory by default).

  Also allows bulk_import_batches.kind = third_party.
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS procurement_source text NOT NULL DEFAULT 'own_stock',
  ADD COLUMN IF NOT EXISTS dealership_name text,
  ADD COLUMN IF NOT EXISTS once_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS once_price_currency text NOT NULL DEFAULT 'JPY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicles_procurement_source_check'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_procurement_source_check
      CHECK (procurement_source IN ('own_stock', 'auction', 'third_party'));
  END IF;
END $$;

-- Existing rows default to own_stock; mark units clearly tied to auction purchases/listings.
UPDATE public.vehicles v
SET procurement_source = 'auction'
WHERE v.procurement_source = 'own_stock'
  AND (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.vehicle_id = v.id AND p.auction_listing_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.auction_listings al
      WHERE al.vehicle_id = v.id
    )
  );

CREATE INDEX IF NOT EXISTS vehicles_procurement_source_idx
  ON public.vehicles (procurement_source);

COMMENT ON COLUMN public.vehicles.procurement_source IS
  'own_stock = company inventory; auction = auction-sourced; third_party = dealership once-price (not our owned stock).';
COMMENT ON COLUMN public.vehicles.dealership_name IS
  'Third-party dealership name when procurement_source = third_party.';
COMMENT ON COLUMN public.vehicles.once_price IS
  'Fixed/once ask price from the dealership (third_party).';
COMMENT ON COLUMN public.vehicles.once_price_currency IS
  'Currency for once_price (JPY or USD).';

-- Extend bulk import kind check for third_party sheets.
ALTER TABLE public.bulk_import_batches
  DROP CONSTRAINT IF EXISTS bulk_import_batches_kind_check;

ALTER TABLE public.bulk_import_batches
  ADD CONSTRAINT bulk_import_batches_kind_check
  CHECK (kind IN ('car', 'machinery', 'parts', 'auctions', 'photos', 'third_party'));
