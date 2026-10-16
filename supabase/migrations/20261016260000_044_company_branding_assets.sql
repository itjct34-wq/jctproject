-- Company letterhead logo already exists (logo_url). Add hanko/seal image URL for print docs.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS hanko_url text;
