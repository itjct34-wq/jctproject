/*
  vehicle_images.image_role — ZIP/file naming roles for ERP vs public gallery.

  Naming (basename, case-insensitive):
    A. / A_  → auction_sheet (ERP only; never public)
    F. / F_  → front
    B. / B_  → back
    else     → gallery

  Anon / public reads exclude auction_sheet. Staff roles still see all roles.
*/

ALTER TABLE public.vehicle_images
  ADD COLUMN IF NOT EXISTS image_role text NOT NULL DEFAULT 'gallery';

UPDATE public.vehicle_images
SET image_role = 'gallery'
WHERE image_role IS NULL OR btrim(image_role) = '';

ALTER TABLE public.vehicle_images
  DROP CONSTRAINT IF EXISTS vehicle_images_image_role_check;

ALTER TABLE public.vehicle_images
  ADD CONSTRAINT vehicle_images_image_role_check
  CHECK (image_role IN ('gallery', 'front', 'back', 'auction_sheet'));

COMMENT ON COLUMN public.vehicle_images.image_role IS
  'Photo role from ZIP/file prefix: auction_sheet (A), front (F), back (B), or gallery. Auction sheets are ERP-only.';

CREATE INDEX IF NOT EXISTS vehicle_images_vehicle_role_idx
  ON public.vehicle_images (vehicle_id, image_role, sort_order);

-- Combined select: public stock never sees auction sheets; staff roles see everything.
DROP POLICY IF EXISTS "vehicle_images_select_ops_or_public_stock" ON public.vehicle_images;
CREATE POLICY "vehicle_images_select_ops_or_public_stock"
  ON public.vehicle_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND (
          public.is_admin_user()
          OR public.has_role('operations')
          OR public.has_role('manager')
          OR public.has_role('sales_agent')
          OR public.has_role('freelancer')
          OR public.has_role('auditor')
          OR (
            v.status IN ('in_stock', 'reserved')
            AND image_role IS DISTINCT FROM 'auction_sheet'
          )
        )
    )
  );

DROP POLICY IF EXISTS "vehicle_images_public_select_available" ON public.vehicle_images;
CREATE POLICY "vehicle_images_public_select_available"
  ON public.vehicle_images
  FOR SELECT TO anon
  USING (
    image_role IS DISTINCT FROM 'auction_sheet'
    AND EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND v.status IN ('in_stock', 'reserved')
    )
  );

GRANT SELECT (id, vehicle_id, image_url, sort_order, is_primary, image_role) ON public.vehicle_images TO anon;
