/*
  Add primary image URL to vehicles for public inventory cards and ERP display.
  Images can be hosted on Supabase Storage or any public CDN URL.
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url text;

COMMENT ON COLUMN public.vehicles.primary_image_url IS 'Public URL of the main vehicle photo for inventory cards and listings';

-- Allow anonymous read of in-stock / reserved vehicles for the public site
-- (only non-sensitive columns are selected by the client)
DROP POLICY IF EXISTS "vehicles_public_select_available" ON public.vehicles;
CREATE POLICY "vehicles_public_select_available" ON public.vehicles
  FOR SELECT TO anon
  USING (status IN ('in_stock', 'reserved'));
