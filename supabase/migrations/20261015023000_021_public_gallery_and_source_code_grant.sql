-- Public site: gallery rows for ZIP photos, plus ISO source-country code for flags.
-- Runs after 020 (vehicle_images table + storage bucket).

GRANT SELECT (source_country_code) ON public.vehicles TO anon;

CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_images_vehicle_idx
  ON public.vehicle_images (vehicle_id, sort_order);

ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_images_public_select_available" ON public.vehicle_images;
CREATE POLICY "vehicle_images_public_select_available"
  ON public.vehicle_images
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND v.status IN ('in_stock', 'reserved')
    )
  );

GRANT SELECT (id, vehicle_id, image_url, sort_order, is_primary) ON public.vehicle_images TO anon;

DROP POLICY IF EXISTS "vehicle_images_storage_public_read" ON storage.objects;
CREATE POLICY "vehicle_images_storage_public_read"
  ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'vehicle-images');
