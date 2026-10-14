import { resolveSourceCountry } from '@/lib/source-countries';

export type PublicCountry = {
  name: string;
  iso2: string;
  guideSlug: string;
  port?: string;
};

/** Export destinations shown on the public site. */
export const DESTINATION_COUNTRIES: PublicCountry[] = [
  { name: 'Ghana', iso2: 'gh', guideSlug: 'ghana', port: 'Tema' },
  { name: 'Kenya', iso2: 'ke', guideSlug: 'kenya', port: 'Mombasa' },
  { name: 'Tanzania', iso2: 'tz', guideSlug: 'tanzania', port: 'Dar es Salaam' },
  { name: 'Nigeria', iso2: 'ng', guideSlug: 'nigeria', port: 'Lagos' },
  { name: 'Jamaica', iso2: 'jm', guideSlug: 'jamaica', port: 'Kingston' },
  { name: 'Guyana', iso2: 'gy', guideSlug: 'guyana', port: 'Georgetown' },
  { name: 'Trinidad and Tobago', iso2: 'tt', guideSlug: 'trinidad-and-tobago', port: 'Port of Spain' },
  { name: 'United Kingdom', iso2: 'gb', guideSlug: 'united-kingdom', port: 'Southampton' },
  { name: 'Pakistan', iso2: 'pk', guideSlug: 'pakistan', port: 'Karachi' },
  { name: 'Mongolia', iso2: 'mn', guideSlug: 'mongolia', port: 'Ulaanbaatar' },
  { name: 'Australia', iso2: 'au', guideSlug: 'australia', port: 'Melbourne' },
  { name: 'Bangladesh', iso2: 'bd', guideSlug: 'bangladesh', port: 'Chittagong' },
  { name: 'Malaysia', iso2: 'my', guideSlug: 'malaysia', port: 'Port Klang' },
  { name: 'New Zealand', iso2: 'nz', guideSlug: 'new-zealand', port: 'Auckland' },
  { name: 'Singapore', iso2: 'sg', guideSlug: 'singapore', port: 'Singapore' },
  { name: 'South Africa', iso2: 'za', guideSlug: 'south-africa', port: 'Durban' },
  { name: 'Sri Lanka', iso2: 'lk', guideSlug: 'sri-lanka', port: 'Colombo' },
  { name: 'Thailand', iso2: 'th', guideSlug: 'thailand', port: 'Laem Chabang' },
  { name: 'United Arab Emirates', iso2: 'ae', guideSlug: 'united-arab-emirates', port: 'Jebel Ali' },
  { name: 'Zambia', iso2: 'zm', guideSlug: 'zambia', port: 'Lusaka (via Durban)' },
];

export const ORIGIN_COUNTRY: PublicCountry = {
  name: 'Japan',
  iso2: 'jp',
  guideSlug: 'japan',
  port: 'Nagoya',
};

const NAME_ALIASES: Record<string, string> = {
  uk: 'gb',
  'united kingdom': 'gb',
  'great britain': 'gb',
  britain: 'gb',
  england: 'gb',
  uae: 'ae',
  emirates: 'ae',
  'united arab emirates': 'ae',
  trinidad: 'tt',
  'trinidad & tobago': 'tt',
  'trinidad and tobago': 'tt',
  tz: 'tz',
  'south africa': 'za',
  'sri lanka': 'lk',
  'new zealand': 'nz',
  usa: 'us',
  'united states': 'us',
  japan: 'jp',
  nippon: 'jp',
};

const ISO_NAMES: Record<string, string> = Object.fromEntries([
  ...DESTINATION_COUNTRIES.map((c) => [c.iso2, c.name] as const),
  [ORIGIN_COUNTRY.iso2, ORIGIN_COUNTRY.name],
]);

export function normalizeIso2(value: string | null | undefined): string | null {
  if (!value) return null;
  const known = resolveSourceCountry(value);
  if (known) return known.code.toLowerCase();
  const raw = value.trim();
  if (!raw) return null;
  if (/^[a-zA-Z]{2}$/.test(raw)) return raw.toLowerCase();
  const aliased = NAME_ALIASES[raw.toLowerCase()];
  if (aliased) return aliased;
  const match = DESTINATION_COUNTRIES.find((c) => c.name.toLowerCase() === raw.toLowerCase());
  if (match) return match.iso2;
  return null;
}

export function countryDisplayName(value: string | null | undefined): string {
  if (!value) return '';
  const known = resolveSourceCountry(value);
  if (known) return known.name;
  const iso = normalizeIso2(value);
  if (iso && ISO_NAMES[iso]) return ISO_NAMES[iso];
  return value.trim();
}

export function flagCdnUrl(iso2: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${iso2.toLowerCase()}.png`;
}

export function flagEmoji(iso2: string): string {
  const code = iso2.toUpperCase();
  if (code.length !== 2) return '';
  return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function destinationNames(): string[] {
  return DESTINATION_COUNTRIES.map((c) => c.name);
}
