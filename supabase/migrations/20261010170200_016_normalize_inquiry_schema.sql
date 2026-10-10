-- Normalize the legacy inquiry schema to support canonical inquiry references and status workflow.
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS inquiry_code text;
UPDATE public.inquiries SET inquiry_code='JCT-INQ-'||lpad(inquiry_number::text,6,'0') WHERE inquiry_code IS NULL;
ALTER TABLE public.inquiries ALTER COLUMN inquiry_code SET DEFAULT ('JCT-INQ-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10)));
ALTER TABLE public.inquiries ALTER COLUMN inquiry_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_inquiry_code_uidx ON public.inquiries(inquiry_code);

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS incoterm text;
UPDATE public.inquiries SET incoterm=incoterms WHERE incoterm IS NULL AND incoterms IS NOT NULL;

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_status_check
CHECK (status IN ('new','in_progress','contacted','qualifying','quoted','converted','closed','spam'));
