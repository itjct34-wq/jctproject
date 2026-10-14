/*
  Ensure vehicle_images rows and the public vehicle-images bucket exist
  so bulk ZIP photos and the public gallery can read URLs.
*/

CREATE TABLE IF NOT EXISTS public.vehicle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_images_vehicle_id_idx
  ON public.vehicle_images (vehicle_id, sort_order);

ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_images_select_ops_or_public_stock" ON public.vehicle_images;
CREATE POLICY "vehicle_images_select_ops_or_public_stock"
  ON public.vehicle_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND (
          v.status IN ('in_stock', 'reserved')
          OR public.is_admin_user()
          OR public.has_role('operations')
          OR public.has_role('manager')
          OR public.has_role('sales_agent')
          OR public.has_role('freelancer')
          OR public.has_role('auditor')
        )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vehicle_images_public_read" ON storage.objects;
CREATE POLICY "vehicle_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-images');
