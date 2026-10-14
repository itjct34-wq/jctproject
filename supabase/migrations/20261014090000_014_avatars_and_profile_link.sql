-- 014: avatars bucket + keep offices/shifts readable and linked to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_profiles_office_id ON public.profiles (office_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shift_id ON public.profiles (shift_id);

DROP POLICY IF EXISTS "offices_select_auth" ON public.offices;
CREATE POLICY "offices_select_auth"
  ON public.offices FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "shifts_select_auth" ON public.shifts;
CREATE POLICY "shifts_select_auth"
  ON public.shifts FOR SELECT TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_admin_write" ON storage.objects;
CREATE POLICY "avatars_admin_write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin_user());
