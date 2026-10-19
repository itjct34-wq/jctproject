/*
  vehicle_images.image_role — add yard (Y. / Y_ prefix).

  Yard photos are ERP-only (arrival / yard condition), never public listing.
  Naming (basename, case-insensitive):
    A. / A_  → auction_sheet
    F. / F_  → front
    B. / B_  → back
    Y. / Y_  → yard
    else     → gallery
*/

ALTER TABLE public.vehicle_images
  DROP CONSTRAINT IF EXISTS vehicle_images_image_role_check;

ALTER TABLE public.vehicle_images
  ADD CONSTRAINT vehicle_images_image_role_check
  CHECK (image_role IN ('gallery', 'front', 'back', 'auction_sheet', 'yard'));

COMMENT ON COLUMN public.vehicle_images.image_role IS
  'Photo role: auction_sheet (A), front (F), back (B), yard (Y, ERP only), or gallery. Auction sheets and yard pics are ERP-only.';

-- Combined select: public stock never sees auction sheets or yard pics; staff roles see everything.
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
            AND image_role IS DISTINCT FROM 'yard'
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
    AND image_role IS DISTINCT FROM 'yard'
    AND EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND v.status IN ('in_stock', 'reserved')
    )
  );
