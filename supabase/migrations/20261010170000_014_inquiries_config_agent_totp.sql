-- Structured website inquiries, reusable global config, and agent TOTP flags.
CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_code text NOT NULL DEFAULT ('JCT-INQ-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 160),
  email text NOT NULL CHECK (length(trim(email)) <= 254),
  phone text,
  company_name text,
  destination_country text,
  destination_port text,
  vehicle_make text,
  vehicle_model text,
  year_from integer,
  year_to integer,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('JPY','USD','EUR','GBP','PKR')),
  incoterm text CHECK (incoterm IN ('FOB','CFR','CIF','EXW')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  message text NOT NULL CHECK (length(trim(message)) BETWEEN 5 AND 8000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualifying','quoted','converted','closed','spam')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_status_created_idx ON public.inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_assigned_idx ON public.inquiries(assigned_to, status);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inquiries_public_insert ON public.inquiries;
CREATE POLICY inquiries_public_insert ON public.inquiries FOR INSERT TO anon, authenticated
WITH CHECK (status='new' AND assigned_to IS NULL AND source='website' AND created_at <= now()+interval '1 minute');
DROP POLICY IF EXISTS inquiries_staff_read ON public.inquiries;
CREATE POLICY inquiries_staff_read ON public.inquiries FOR SELECT TO authenticated
USING (public.has_permission('customers','view'));
DROP POLICY IF EXISTS inquiries_staff_update ON public.inquiries;
CREATE POLICY inquiries_staff_update ON public.inquiries FOR UPDATE TO authenticated
USING (public.has_permission('customers','edit'))
WITH CHECK (public.has_permission('customers','edit'));

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_config_read ON public.system_config;
CREATE POLICY system_config_read ON public.system_config FOR SELECT TO authenticated
USING (public.has_permission('settings','view'));
DROP POLICY IF EXISTS system_config_update ON public.system_config;
DROP POLICY IF EXISTS system_config_write ON public.system_config;
CREATE POLICY system_config_write ON public.system_config FOR ALL TO authenticated
USING (public.has_permission('settings','edit'))
WITH CHECK (public.has_permission('settings','edit'));

INSERT INTO public.system_config(key,value,description) VALUES
('currencies','["JPY","USD","EUR","GBP","PKR"]'::jsonb,'Supported currency codes'),
('freight_destinations','["United Arab Emirates","Australia","Bangladesh","Chile","Fiji","Georgia","Ghana","Hong Kong","Jamaica","Kenya","Malaysia","Mauritius","Mozambique","New Zealand","Pakistan","Singapore","South Africa","Sri Lanka","Tanzania","Thailand","Trinidad and Tobago","Uganda","United Kingdom","Zambia"]'::jsonb,'Selectable export destination countries; super-admin configurable'),
('incoterms','["FOB","CFR","CIF","EXW"]'::jsonb,'Supported quotation and shipping terms'),
('shipment_types','["RORO","Container","Bulk"]'::jsonb,'Supported shipment types')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.agent_verifications ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.agent_verifications.totp_enabled IS 'Enables server-calculated 30-second HMAC time-based agent verification codes. Configure AGENT_TOTP_SECRET on the server.';
