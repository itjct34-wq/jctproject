/*
  Hot-path indexes for public catalog + ERP joins.
  Safe / additive only — does not change RLS or print layouts.
*/

-- Public / ERP listed-stock scans: status filter + stock_number sort
CREATE INDEX IF NOT EXISTS vehicles_listed_stock_number_idx
  ON public.vehicles (stock_number DESC)
  WHERE status IN ('in_stock', 'reserved');

-- Catalog category filter on listed stock (cars / machinery / parts)
CREATE INDEX IF NOT EXISTS vehicles_listed_category_idx
  ON public.vehicles (stock_category, stock_number DESC)
  WHERE status IN ('in_stock', 'reserved');

-- FK join helpers reported missing by Supabase performance advisors
CREATE INDEX IF NOT EXISTS auction_listings_vehicle_id_idx
  ON public.auction_listings (vehicle_id);

CREATE INDEX IF NOT EXISTS invoice_items_vehicle_id_idx
  ON public.invoice_items (vehicle_id);

CREATE INDEX IF NOT EXISTS shipment_items_vehicle_id_idx
  ON public.shipment_items (vehicle_id);

-- Duplicate index pair on vehicle_images (advisor: duplicate_index)
DROP INDEX IF EXISTS public.vehicle_images_vehicle_idx;
