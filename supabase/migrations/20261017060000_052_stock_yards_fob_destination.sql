/*
  # Stock yards, FOB JPY, destination country

  - vehicles.fob_jpy (bid + 10% + expense), destination_country
  - yards catalog linked to export port_name; vehicles.yard_id
  - Seed yards for major Japan export ports
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fob_jpy numeric,
  ADD COLUMN IF NOT EXISTS destination_country text,
  ADD COLUMN IF NOT EXISTS yard_id uuid;

COMMENT ON COLUMN public.vehicles.fob_jpy IS
  'Vehicle cost in JPY = bid + 10% markup + expense_jpy.';
COMMENT ON COLUMN public.vehicles.destination_country IS
  'Intended destination country for the unit (buyer market).';

CREATE TABLE IF NOT EXISTS public.yards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  port_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  sort_order int NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yards_port_name_unique UNIQUE (port_name, name)
);

CREATE INDEX IF NOT EXISTS idx_yards_port ON public.yards(port_name);
CREATE INDEX IF NOT EXISTS idx_yards_status ON public.yards(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_yard_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_yard_id_fkey
      FOREIGN KEY (yard_id) REFERENCES public.yards(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_yard_id ON public.vehicles(yard_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_destination_country ON public.vehicles(destination_country);

ALTER TABLE public.yards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS yards_select ON public.yards;
CREATE POLICY yards_select ON public.yards
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS yards_write ON public.yards;
CREATE POLICY yards_write ON public.yards
  FOR ALL TO authenticated
  USING (public.is_admin_user() OR public.has_permission('settings', 'edit'))
  WITH CHECK (public.is_admin_user() OR public.has_permission('settings', 'edit'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.yards TO authenticated;

-- Seed yards by export port (matches auction house city / POL)
INSERT INTO public.yards (name, port_name, sort_order, notes)
VALUES
  ('Nagoya Main Yard', 'Nagoya', 10, 'Primary Nagoya holding yard'),
  ('Nagoya CFS', 'Nagoya', 20, 'Nagoya container freight station'),
  ('Yokohama Main Yard', 'Yokohama', 10, 'Primary Yokohama holding yard'),
  ('Yokohama Daikoku', 'Yokohama', 20, 'Daikoku pier area'),
  ('Kobe Main Yard', 'Kobe', 10, 'Primary Kobe holding yard'),
  ('Kobe Rokko', 'Kobe', 20, 'Rokko island yard'),
  ('Hakata Main Yard', 'Hakata', 10, 'Primary Hakata / Fukuoka yard'),
  ('Osaka Main Yard', 'Osaka', 10, 'Osaka holding yard'),
  ('Moji Yard', 'Moji', 10, 'Kitakyushu / Moji yard'),
  ('Kawasaki Yard', 'Kawasaki', 10, 'Kawasaki holding yard')
ON CONFLICT (port_name, name) DO NOTHING;

-- Backfill fob_jpy from existing bid/expense where missing
UPDATE public.vehicles
SET fob_jpy = ROUND(
  COALESCE(purchase_price, 0)
  + COALESCE(purchase_price, 0) * 0.1
  + COALESCE(expense_jpy, 45000)
, 0)
WHERE fob_jpy IS NULL
  AND purchase_price IS NOT NULL
  AND purchase_price > 0;
