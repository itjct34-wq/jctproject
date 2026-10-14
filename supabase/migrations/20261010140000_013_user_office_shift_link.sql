-- 013: link users to offices/shifts, restore read access, seed day shifts

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_profiles_office_id ON public.profiles (office_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shift_id ON public.profiles (shift_id);

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offices_select_auth" ON public.offices;
CREATE POLICY "offices_select_auth"
  ON public.offices FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "shifts_select_auth" ON public.shifts;
CREATE POLICY "shifts_select_auth"
  ON public.shifts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "offices_manage_admin" ON public.offices;
CREATE POLICY "offices_manage_admin"
  ON public.offices FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "shifts_manage_admin" ON public.shifts;
CREATE POLICY "shifts_manage_admin"
  ON public.shifts FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Non-admins cannot change their own office, shift, or active flag.
-- Service-role updates (auth.uid() is null) are allowed so invite-user works.
CREATE OR REPLACE FUNCTION public.protect_profile_scoping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin_user() THEN
    NEW.office_id := OLD.office_id;
    NEW.shift_id := OLD.shift_id;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_scoping ON public.profiles;
CREATE TRIGGER protect_profile_scoping
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_scoping();

REVOKE EXECUTE ON FUNCTION public.protect_profile_scoping() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'shifts'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(office_id, code)%'
  ) THEN
    ALTER TABLE public.shifts
      ADD CONSTRAINT shifts_office_id_code_key UNIQUE (office_id, code);
  END IF;
EXCEPTION
  WHEN unique_violation OR duplicate_table OR duplicate_object THEN
    NULL;
END $$;

INSERT INTO public.shifts (office_id, code, name, start_time, end_time, is_active)
SELECT o.id, v.code, v.name, v.start_time::time, v.end_time::time, true
FROM public.offices o
CROSS JOIN (VALUES
  ('DAY', 'Day shift', '09:00', '18:00'),
  ('NIGHT', 'Night shift', '18:00', '03:00')
) AS v(code, name, start_time, end_time)
WHERE o.code IN ('NGO', 'KHI')
  AND NOT EXISTS (
    SELECT 1
    FROM public.shifts s
    WHERE s.office_id = o.id
      AND s.code = v.code
  );
