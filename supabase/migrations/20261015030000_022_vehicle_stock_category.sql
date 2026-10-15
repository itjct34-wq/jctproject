-- Public catalogs: cars, machinery, and parts share public.vehicles.
-- Existing rows default to car so /inventory stays unchanged.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS stock_category text NOT NULL DEFAULT 'car';

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_stock_category_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_stock_category_check
  CHECK (stock_category IN ('car', 'machinery', 'parts'));

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS part_sku text;

CREATE INDEX IF NOT EXISTS vehicles_stock_category_idx
  ON public.vehicles (stock_category);

CREATE INDEX IF NOT EXISTS vehicles_part_sku_idx
  ON public.vehicles (part_sku);

COMMENT ON COLUMN public.vehicles.stock_category IS
  'Public listing catalog: car | machinery | parts. Default car keeps existing stock on the cars page.';

COMMENT ON COLUMN public.vehicles.part_sku IS
  'Optional part number / SKU. Photo ZIP folders may match chassis_number, stock_number, or part_sku.';

GRANT SELECT (stock_category, part_sku) ON public.vehicles TO anon;
