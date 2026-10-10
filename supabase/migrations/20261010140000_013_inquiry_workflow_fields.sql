ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS inquiry_code text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS destination_port text,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS year_from integer,
  ADD COLUMN IF NOT EXISTS year_to integer,
  ADD COLUMN IF NOT EXISTS budget_min numeric,
  ADD COLUMN IF NOT EXISTS budget_max numeric;

UPDATE public.inquiries
SET inquiry_code = 'JCT-INQ-' || lpad(inquiry_number::text, 7, '0')
WHERE inquiry_code IS NULL;

ALTER TABLE public.inquiries ALTER COLUMN inquiry_code SET DEFAULT ('JCT-INQ-' || lpad(nextval(pg_get_serial_sequence('public.inquiries','inquiry_number'))::text, 7, '0'));
ALTER TABLE public.inquiries ALTER COLUMN inquiry_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_inquiry_code_key ON public.inquiries(inquiry_code);

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_status_check
  CHECK (status = ANY (ARRAY['new','in_progress','quoted','converted','closed','spam']));

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_year_range_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_year_range_check CHECK (year_from IS NULL OR year_to IS NULL OR year_from <= year_to);
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_budget_range_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_budget_range_check CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max);
