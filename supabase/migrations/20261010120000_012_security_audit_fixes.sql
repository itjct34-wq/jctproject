-- 012: security audit fixes (idempotent)
-- 1. Replace "any signed-in user can write" policies with role-based ones
-- 2. Stop the public API from exposing cost/supplier columns
-- 3. Lock down SECURITY DEFINER function execution
-- 4. Add missing foreign-key indexes

-- ---------------------------------------------------------------------------
-- 1. Write policies
-- ---------------------------------------------------------------------------

-- agent_verifications: public trust records, writable by admin/manager only
DROP POLICY IF EXISTS "agent_auth_write" ON public.agent_verifications;
DROP POLICY IF EXISTS "agent_manage_admin_manager" ON public.agent_verifications;
CREATE POLICY "agent_manage_admin_manager"
  ON public.agent_verifications FOR ALL TO authenticated
  USING (public.is_admin_user() OR public.has_role('manager'))
  WITH CHECK (public.is_admin_user() OR public.has_role('manager'));

-- blog_posts
DROP POLICY IF EXISTS "blog_auth_write" ON public.blog_posts;
DROP POLICY IF EXISTS "blog_manage_admin_manager" ON public.blog_posts;
CREATE POLICY "blog_manage_admin_manager"
  ON public.blog_posts FOR ALL TO authenticated
  USING (public.is_admin_user() OR public.has_role('manager'))
  WITH CHECK (public.is_admin_user() OR public.has_role('manager'));

-- offices (also drop the duplicate select policy)
DROP POLICY IF EXISTS "offices_all_admin" ON public.offices;
DROP POLICY IF EXISTS "offices_manage_admin" ON public.offices;
DROP POLICY IF EXISTS "offices_select_auth" ON public.offices;
CREATE POLICY "offices_manage_admin"
  ON public.offices FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- shifts (also drop the duplicate select policy)
DROP POLICY IF EXISTS "shifts_all_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_manage_admin" ON public.shifts;
DROP POLICY IF EXISTS "shifts_select_auth" ON public.shifts;
CREATE POLICY "shifts_manage_admin"
  ON public.shifts FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- vehicle_images: same roles that may edit vehicles
DROP POLICY IF EXISTS "vehicle_images_auth_all" ON public.vehicle_images;
DROP POLICY IF EXISTS "vehicle_images_insert_ops" ON public.vehicle_images;
DROP POLICY IF EXISTS "vehicle_images_update_ops" ON public.vehicle_images;
DROP POLICY IF EXISTS "vehicle_images_delete_ops" ON public.vehicle_images;
CREATE POLICY "vehicle_images_insert_ops"
  ON public.vehicle_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'));
CREATE POLICY "vehicle_images_update_ops"
  ON public.vehicle_images FOR UPDATE TO authenticated
  USING (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'))
  WITH CHECK (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'));
CREATE POLICY "vehicle_images_delete_ops"
  ON public.vehicle_images FOR DELETE TO authenticated
  USING (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'));

-- audit_logs: users may only write log rows attributed to themselves
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- storage: vehicle-images bucket writes limited to the same roles
DROP POLICY IF EXISTS "vehicle_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "vehicle_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "vehicle_images_auth_delete" ON storage.objects;
CREATE POLICY "vehicle_images_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-images'
    AND (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'))
  );
CREATE POLICY "vehicle_images_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'))
  );
CREATE POLICY "vehicle_images_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vehicle-images'
    AND (public.is_admin_user() OR public.has_role('operations') OR public.has_role('manager'))
  );

-- ---------------------------------------------------------------------------
-- 2. Hide internal columns from the anonymous (public website) role.
--    Row filtering stays in the existing RLS policies; this limits columns.
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.vehicles FROM anon;
GRANT SELECT (
  id, stock_number, chassis_number, make, model, model_grade, model_year,
  registration_year, color, mileage_km, transmission, fuel_type, source_country,
  listed_price, listed_currency, status, primary_image_url, notes
) ON public.vehicles TO anon;

REVOKE SELECT ON public.agent_verifications FROM anon;
GRANT SELECT (
  id, agent_code, full_name, email, phone, title, photo_url,
  is_active, verified_until, representative_type
) ON public.agent_verifications TO anon;

-- ---------------------------------------------------------------------------
-- 3. SECURITY DEFINER functions
--    Trigger functions never need to be callable through the REST API.
--    RLS helper functions stay callable by signed-in users only.
--    verify_invoice stays public on purpose (invoice QR verification page).
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.check_self_role_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_agent_verification_for_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- ---------------------------------------------------------------------------
-- 4. Index every foreign key that has no covering index
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  idx_name text;
BEGIN
  FOR r IN
    SELECT
      c.conrelid::regclass AS tbl,
      c.conname,
      (
        SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) AS cols
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    idx_name := left('idx_' || regexp_replace(r.conname, '_fkey$', ''), 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', idx_name, r.tbl, r.cols);
  END LOOP;
END $$;
