/*
  # Customer POD + shipping / make-model catalogs

  - customers.port_of_discharge for default POD autofill on invoices/quotes/reserves
  - quotations.port_of_discharge so quote print shows POD
  - Catalog tables: shipping_lines, vessels, voyages, vehicle_makes, vehicle_models
  - RLS: authenticated read; admins / settings managers write
  - Seed starter data for Japan used-car export workflows
*/

-- ---------------------------------------------------------------------------
-- Customer / quotation POD
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS port_of_discharge text;

COMMENT ON COLUMN public.customers.port_of_discharge IS
  'Default port of discharge for invoices, quotations, and reservations.';

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS port_of_discharge text;

COMMENT ON COLUMN public.quotations.port_of_discharge IS
  'Port of discharge printed on the commercial quotation.';

-- ---------------------------------------------------------------------------
-- Catalog tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  country text DEFAULT 'Japan',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipping_lines_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_shipping_lines_status ON public.shipping_lines(status);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_name ON public.shipping_lines(name);

CREATE TABLE IF NOT EXISTS public.vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  imo_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vessels_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_vessels_status ON public.vessels(status);
CREATE INDEX IF NOT EXISTS idx_vessels_line ON public.vessels(shipping_line_id);

CREATE TABLE IF NOT EXISTS public.voyages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_number text NOT NULL,
  vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  etd date,
  eta date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voyages_number_vessel_unique UNIQUE (voyage_number, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_voyages_status ON public.voyages(status);
CREATE INDEX IF NOT EXISTS idx_voyages_vessel ON public.voyages(vessel_id);
CREATE INDEX IF NOT EXISTS idx_voyages_line ON public.voyages(shipping_line_id);

CREATE TABLE IF NOT EXISTS public.vehicle_makes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order int NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_makes_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_makes_status ON public.vehicle_makes(status);

CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id uuid NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order int NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_models_make_name_unique UNIQUE (make_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_make ON public.vehicle_models(make_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_status ON public.vehicle_models(status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipping_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voyages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_lines_select ON public.shipping_lines;
CREATE POLICY shipping_lines_select ON public.shipping_lines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS shipping_lines_write ON public.shipping_lines;
CREATE POLICY shipping_lines_write ON public.shipping_lines
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  );

DROP POLICY IF EXISTS vessels_select ON public.vessels;
CREATE POLICY vessels_select ON public.vessels
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vessels_write ON public.vessels;
CREATE POLICY vessels_write ON public.vessels
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  );

DROP POLICY IF EXISTS voyages_select ON public.voyages;
CREATE POLICY voyages_select ON public.voyages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS voyages_write ON public.voyages;
CREATE POLICY voyages_write ON public.voyages
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  );

DROP POLICY IF EXISTS vehicle_makes_select ON public.vehicle_makes;
CREATE POLICY vehicle_makes_select ON public.vehicle_makes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vehicle_makes_write ON public.vehicle_makes;
CREATE POLICY vehicle_makes_write ON public.vehicle_makes
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  );

DROP POLICY IF EXISTS vehicle_models_select ON public.vehicle_models;
CREATE POLICY vehicle_models_select ON public.vehicle_models
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vehicle_models_write ON public.vehicle_models;
CREATE POLICY vehicle_models_write ON public.vehicle_models
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.has_permission('settings', 'edit')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voyages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_makes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_models TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed: shipping lines, vessels, voyages
-- ---------------------------------------------------------------------------
INSERT INTO public.shipping_lines (name, code, country, notes)
VALUES
  ('NYK RORO', 'NYK', 'Japan', 'Nippon Yusen RORO services'),
  ('K Line', 'KL', 'Japan', 'Kawasaki Kisen'),
  ('MOL', 'MOL', 'Japan', 'Mitsui O.S.K. Lines'),
  ('Wallenius Wilhelmsen', 'WWL', 'Norway', 'WWL RORO'),
  ('Hoegh Autoliners', 'HOEGH', 'Norway', 'Hoegh PCTC'),
  ('COSCO Shipping Specialized', 'COSCO', 'China', 'RORO / specialized'),
  ('UECC', 'UECC', 'Norway', 'United European Car Carriers'),
  ('Toyofuji Shipping', 'TOYOFUJI', 'Japan', 'Toyota-related RORO')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.vessels (name, shipping_line_id, notes)
SELECT v.name, sl.id, v.notes
FROM (VALUES
  ('PRESTIGE ACE', 'NYK RORO', 'Sample NYK RORO vessel'),
  ('MERCURY ACE', 'NYK RORO', 'Sample NYK RORO vessel'),
  ('GLOVIS CONDOR', 'K Line', 'Sample K Line vessel'),
  ('GLOVIS SILVER', 'K Line', 'Sample K Line vessel'),
  ('MORNING CROWN', 'MOL', 'Sample MOL vessel'),
  ('MORNING COMPOSER', 'MOL', 'Sample MOL vessel'),
  ('TONSBERG', 'Wallenius Wilhelmsen', 'Sample WWL vessel'),
  ('THERMOPYLAE', 'Wallenius Wilhelmsen', 'Sample WWL vessel'),
  ('HOEGH TRACER', 'Hoegh Autoliners', 'Sample Hoegh vessel'),
  ('TOYOFUJI MARU', 'Toyofuji Shipping', 'Sample Toyofuji vessel')
) AS v(name, line_name, notes)
JOIN public.shipping_lines sl ON sl.name = v.line_name
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.voyages (voyage_number, vessel_id, shipping_line_id, notes)
SELECT x.voyage_number, vs.id, vs.shipping_line_id, x.notes
FROM (VALUES
  ('PRESTIGE ACE', '001E', 'Nagoya to East Africa stub'),
  ('MERCURY ACE', '012W', 'Yokohama to Middle East stub'),
  ('GLOVIS CONDOR', '051S', 'Kobe to South Asia stub'),
  ('MORNING CROWN', '088A', 'Nagoya to Africa stub'),
  ('TONSBERG', '220N', 'WWL Far East stub'),
  ('HOEGH TRACER', 'H17', 'Hoegh Asia stub'),
  ('TOYOFUJI MARU', 'TF09', 'Domestic feeder stub')
) AS x(vessel_name, voyage_number, notes)
JOIN public.vessels vs ON vs.name = x.vessel_name
ON CONFLICT (voyage_number, vessel_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed: common Japan used-car makes / models
-- ---------------------------------------------------------------------------
INSERT INTO public.vehicle_makes (name, sort_order)
VALUES
  ('Toyota', 10),
  ('Honda', 20),
  ('Nissan', 30),
  ('Suzuki', 40),
  ('Mazda', 50),
  ('Daihatsu', 60),
  ('Mitsubishi', 70),
  ('Subaru', 80),
  ('Isuzu', 90),
  ('Hino', 100),
  ('Lexus', 110),
  ('Other', 999)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.vehicle_models (make_id, name, sort_order)
SELECT m.id, x.model, x.sort_order
FROM (VALUES
  ('Toyota', 'Land Cruiser', 10),
  ('Toyota', 'Land Cruiser Prado', 20),
  ('Toyota', 'Hiace', 30),
  ('Toyota', 'Hilux', 40),
  ('Toyota', 'Aqua', 50),
  ('Toyota', 'Prius', 60),
  ('Toyota', 'Corolla Axio', 70),
  ('Toyota', 'Corolla Fielder', 80),
  ('Toyota', 'Vitz', 90),
  ('Toyota', 'Passo', 100),
  ('Toyota', 'Noah', 110),
  ('Toyota', 'Voxy', 120),
  ('Toyota', 'Alphard', 130),
  ('Toyota', 'Wish', 140),
  ('Honda', 'Fit', 10),
  ('Honda', 'Vezel', 20),
  ('Honda', 'Freed', 30),
  ('Honda', 'Odyssey', 40),
  ('Honda', 'N-BOX', 50),
  ('Honda', 'N-WGN', 60),
  ('Honda', 'Stepwgn', 70),
  ('Honda', 'CR-V', 80),
  ('Honda', 'Civic', 90),
  ('Nissan', 'Note', 10),
  ('Nissan', 'Serena', 20),
  ('Nissan', 'X-Trail', 30),
  ('Nissan', 'Dayz', 40),
  ('Nissan', 'March', 50),
  ('Nissan', 'Clipper', 60),
  ('Nissan', 'Caravan', 70),
  ('Nissan', 'Navara', 80),
  ('Suzuki', 'Every', 10),
  ('Suzuki', 'Jimny', 20),
  ('Suzuki', 'Alto', 30),
  ('Suzuki', 'Wagon R', 40),
  ('Suzuki', 'Swift', 50),
  ('Suzuki', 'Hustler', 60),
  ('Suzuki', 'Carry', 70),
  ('Mazda', 'Demio', 10),
  ('Mazda', 'CX-5', 20),
  ('Mazda', 'CX-3', 30),
  ('Mazda', 'Axela', 40),
  ('Mazda', 'Atenza', 50),
  ('Mazda', 'Bongo', 60),
  ('Daihatsu', 'Hijet', 10),
  ('Daihatsu', 'Move', 20),
  ('Daihatsu', 'Mira', 30),
  ('Daihatsu', 'Tanto', 40),
  ('Daihatsu', 'Atrai', 50),
  ('Mitsubishi', 'Pajero', 10),
  ('Mitsubishi', 'Outlander', 20),
  ('Mitsubishi', 'Delica', 30),
  ('Mitsubishi', 'Minicab', 40),
  ('Mitsubishi', 'Canter', 50),
  ('Subaru', 'Impreza', 10),
  ('Subaru', 'Forester', 20),
  ('Subaru', 'Legacy', 30),
  ('Isuzu', 'Elf', 10),
  ('Isuzu', 'Forward', 20),
  ('Hino', 'Dutro', 10),
  ('Hino', 'Ranger', 20),
  ('Lexus', 'RX', 10),
  ('Lexus', 'LX', 20),
  ('Other', 'Custom', 10)
) AS x(make_name, model, sort_order)
JOIN public.vehicle_makes m ON m.name = x.make_name
ON CONFLICT (make_id, name) DO NOTHING;
