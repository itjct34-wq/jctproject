-- Offices, shifts, profile scoping, vehicle image
-- Run this in Supabase SQL Editor if not applied via CLI

CREATE TABLE IF NOT EXISTS public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  country text,
  city text,
  address text,
  timezone text DEFAULT 'Asia/Tokyo',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  start_time time,
  end_time time,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (office_id, code)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url text;

INSERT INTO public.offices (code, name, country, city, timezone)
VALUES
  ('NGO', 'Nagoya HQ', 'Japan', 'Nagoya', 'Asia/Tokyo'),
  ('KHI', 'Karachi Office', 'Pakistan', 'Karachi', 'Asia/Karachi')
ON CONFLICT (code) DO NOTHING;
