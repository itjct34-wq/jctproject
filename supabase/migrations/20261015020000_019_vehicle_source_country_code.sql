/*
  Persist ISO source-country codes on vehicles so public inventory can
  group/filter by market and render country flags.
  source_country remains the display name; source_country_code is ISO 3166-1 alpha-2.
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS source_country_code text;

COMMENT ON COLUMN public.vehicles.source_country IS
  'Source market display name (e.g. Japan). Group public inventory by this field.';
COMMENT ON COLUMN public.vehicles.source_country_code IS
  'ISO 3166-1 alpha-2 code (e.g. JP) for source-country flags and filters.';

CREATE INDEX IF NOT EXISTS vehicles_source_country_code_idx
  ON public.vehicles (source_country_code);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_source_country_code_chk;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_source_country_code_chk
  CHECK (source_country_code IS NULL OR source_country_code ~ '^[A-Z]{2}$');

UPDATE public.vehicles
SET source_country_code = CASE
  WHEN source_country_code ~ '^[A-Za-z]{2}$' THEN upper(source_country_code)
  WHEN upper(trim(coalesce(source_country, ''))) ~ '^[A-Z]{2}$' THEN upper(trim(source_country))
  WHEN upper(trim(coalesce(source_country, ''))) IN ('JAPAN', 'JPN') THEN 'JP'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('UNITED ARAB EMIRATES', 'UAE', 'DUBAI', 'ARE') THEN 'AE'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('UNITED KINGDOM', 'UK', 'GREAT BRITAIN', 'GBR', 'ENGLAND') THEN 'GB'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('UNITED STATES', 'USA', 'US', 'AMERICA') THEN 'US'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('KENYA', 'KEN') THEN 'KE'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('TANZANIA', 'TZA') THEN 'TZ'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('UGANDA', 'UGA') THEN 'UG'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('SOUTH AFRICA', 'RSA', 'ZAF') THEN 'ZA'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('NIGERIA', 'NGA') THEN 'NG'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('GHANA', 'GHA') THEN 'GH'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('ZIMBABWE', 'ZWE') THEN 'ZW'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('ZAMBIA', 'ZMB') THEN 'ZM'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('MALAWI', 'MWI') THEN 'MW'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('MOZAMBIQUE', 'MOZ') THEN 'MZ'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('BOTSWANA', 'BWA') THEN 'BW'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('NAMIBIA', 'NAM') THEN 'NA'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('RWANDA', 'RWA') THEN 'RW'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('ETHIOPIA', 'ETH') THEN 'ET'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('EGYPT', 'EGY') THEN 'EG'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('SAUDI ARABIA', 'KSA', 'SAU') THEN 'SA'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('QATAR', 'QAT') THEN 'QA'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('KUWAIT', 'KWT') THEN 'KW'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('OMAN', 'OMN') THEN 'OM'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('PAKISTAN', 'PAK') THEN 'PK'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('INDIA', 'IND') THEN 'IN'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('BANGLADESH', 'BGD') THEN 'BD'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('SRI LANKA', 'LKA') THEN 'LK'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('THAILAND', 'THA') THEN 'TH'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('VIETNAM', 'VIET NAM', 'VNM') THEN 'VN'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('MALAYSIA', 'MYS') THEN 'MY'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('SINGAPORE', 'SGP') THEN 'SG'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('INDONESIA', 'IDN') THEN 'ID'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('PHILIPPINES', 'PHL') THEN 'PH'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('CHINA', 'CHN') THEN 'CN'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('SOUTH KOREA', 'KOREA', 'KOR') THEN 'KR'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('AUSTRALIA', 'AUS') THEN 'AU'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('NEW ZEALAND', 'NZL') THEN 'NZ'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('CANADA', 'CAN') THEN 'CA'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('GERMANY', 'DEU') THEN 'DE'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('FRANCE', 'FRA') THEN 'FR'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('ITALY', 'ITA') THEN 'IT'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('NETHERLANDS', 'HOLLAND', 'NLD') THEN 'NL'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('RUSSIA', 'RUS') THEN 'RU'
  WHEN upper(trim(coalesce(source_country, ''))) IN ('TURKEY', 'TURKIYE', 'TÜRKIYE', 'TUR') THEN 'TR'
  ELSE source_country_code
END
WHERE source_country_code IS NULL AND source_country IS NOT NULL AND btrim(source_country) <> '';
