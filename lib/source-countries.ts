/** ISO 3166-1 alpha-2 source markets for stock upload, public grouping, and flags. */

export type SourceCountry = {
  code: string;
  name: string;
  aliases: string[];
};

export const SOURCE_COUNTRIES: SourceCountry[] = [
  { code: 'JP', name: 'Japan', aliases: ['jpn', '日本'] },
  { code: 'AE', name: 'United Arab Emirates', aliases: ['uae', 'u.a.e', 'dubai', 'are'] },
  { code: 'GB', name: 'United Kingdom', aliases: ['uk', 'great britain', 'britain', 'england', 'gbr'] },
  { code: 'US', name: 'United States', aliases: ['usa', 'u.s.a', 'united states of america', 'america'] },
  { code: 'KE', name: 'Kenya', aliases: ['ken'] },
  { code: 'TZ', name: 'Tanzania', aliases: ['tza', 'united republic of tanzania'] },
  { code: 'UG', name: 'Uganda', aliases: ['uga'] },
  { code: 'ZA', name: 'South Africa', aliases: ['rsa', 'zaf'] },
  { code: 'NG', name: 'Nigeria', aliases: ['nga'] },
  { code: 'GH', name: 'Ghana', aliases: ['gha'] },
  { code: 'ZW', name: 'Zimbabwe', aliases: ['zwe'] },
  { code: 'ZM', name: 'Zambia', aliases: ['zmb'] },
  { code: 'MW', name: 'Malawi', aliases: ['mwi'] },
  { code: 'MZ', name: 'Mozambique', aliases: ['moz'] },
  { code: 'BW', name: 'Botswana', aliases: ['bwa'] },
  { code: 'NA', name: 'Namibia', aliases: ['nam'] },
  { code: 'RW', name: 'Rwanda', aliases: ['rwa'] },
  { code: 'ET', name: 'Ethiopia', aliases: ['eth'] },
  { code: 'SS', name: 'South Sudan', aliases: ['ssd'] },
  { code: 'SD', name: 'Sudan', aliases: ['sdn'] },
  { code: 'EG', name: 'Egypt', aliases: ['egy'] },
  { code: 'MA', name: 'Morocco', aliases: ['mar'] },
  { code: 'DZ', name: 'Algeria', aliases: ['dza'] },
  { code: 'TN', name: 'Tunisia', aliases: ['tun'] },
  { code: 'LY', name: 'Libya', aliases: ['lby'] },
  { code: 'SA', name: 'Saudi Arabia', aliases: ['ksa', 'sau'] },
  { code: 'QA', name: 'Qatar', aliases: ['qat'] },
  { code: 'KW', name: 'Kuwait', aliases: ['kwt'] },
  { code: 'OM', name: 'Oman', aliases: ['omn'] },
  { code: 'BH', name: 'Bahrain', aliases: ['bhr'] },
  { code: 'JO', name: 'Jordan', aliases: ['jor'] },
  { code: 'LB', name: 'Lebanon', aliases: ['lbn'] },
  { code: 'IQ', name: 'Iraq', aliases: ['irq'] },
  { code: 'IR', name: 'Iran', aliases: ['irn'] },
  { code: 'PK', name: 'Pakistan', aliases: ['pak'] },
  { code: 'IN', name: 'India', aliases: ['ind'] },
  { code: 'BD', name: 'Bangladesh', aliases: ['bgd'] },
  { code: 'LK', name: 'Sri Lanka', aliases: ['lka'] },
  { code: 'NP', name: 'Nepal', aliases: ['npl'] },
  { code: 'MM', name: 'Myanmar', aliases: ['burma', 'mmr'] },
  { code: 'TH', name: 'Thailand', aliases: ['tha'] },
  { code: 'VN', name: 'Vietnam', aliases: ['vnm', 'viet nam'] },
  { code: 'KH', name: 'Cambodia', aliases: ['khm'] },
  { code: 'LA', name: 'Laos', aliases: ['lao'] },
  { code: 'MY', name: 'Malaysia', aliases: ['mys'] },
  { code: 'SG', name: 'Singapore', aliases: ['sgp'] },
  { code: 'ID', name: 'Indonesia', aliases: ['idn'] },
  { code: 'PH', name: 'Philippines', aliases: ['phl'] },
  { code: 'CN', name: 'China', aliases: ['chn', 'prc'] },
  { code: 'KR', name: 'South Korea', aliases: ['korea', 'republic of korea', 'kor'] },
  { code: 'AU', name: 'Australia', aliases: ['aus'] },
  { code: 'NZ', name: 'New Zealand', aliases: ['nzl'] },
  { code: 'FJ', name: 'Fiji', aliases: ['fji'] },
  { code: 'PG', name: 'Papua New Guinea', aliases: ['png'] },
  { code: 'RU', name: 'Russia', aliases: ['rus'] },
  { code: 'KZ', name: 'Kazakhstan', aliases: ['kaz'] },
  { code: 'GE', name: 'Georgia', aliases: ['geo'] },
  { code: 'AM', name: 'Armenia', aliases: ['arm'] },
  { code: 'AZ', name: 'Azerbaijan', aliases: ['aze'] },
  { code: 'TR', name: 'Turkey', aliases: ['turkiye', 'türkiye', 'tur'] },
  { code: 'CY', name: 'Cyprus', aliases: ['cyp'] },
  { code: 'GR', name: 'Greece', aliases: ['grc'] },
  { code: 'IT', name: 'Italy', aliases: ['ita'] },
  { code: 'DE', name: 'Germany', aliases: ['deu', 'deutschland'] },
  { code: 'FR', name: 'France', aliases: ['fra'] },
  { code: 'ES', name: 'Spain', aliases: ['esp'] },
  { code: 'PT', name: 'Portugal', aliases: ['prt'] },
  { code: 'NL', name: 'Netherlands', aliases: ['holland', 'nld'] },
  { code: 'BE', name: 'Belgium', aliases: ['bel'] },
  { code: 'IE', name: 'Ireland', aliases: ['irl'] },
  { code: 'PL', name: 'Poland', aliases: ['pol'] },
  { code: 'RO', name: 'Romania', aliases: ['rou'] },
  { code: 'BG', name: 'Bulgaria', aliases: ['bgr'] },
  { code: 'HU', name: 'Hungary', aliases: ['hun'] },
  { code: 'CZ', name: 'Czechia', aliases: ['czech republic', 'cze'] },
  { code: 'SE', name: 'Sweden', aliases: ['swe'] },
  { code: 'NO', name: 'Norway', aliases: ['nor'] },
  { code: 'FI', name: 'Finland', aliases: ['fin'] },
  { code: 'DK', name: 'Denmark', aliases: ['dnk'] },
  { code: 'CA', name: 'Canada', aliases: ['can'] },
  { code: 'MX', name: 'Mexico', aliases: ['mex'] },
  { code: 'BR', name: 'Brazil', aliases: ['bra'] },
  { code: 'CL', name: 'Chile', aliases: ['chl'] },
  { code: 'AR', name: 'Argentina', aliases: ['arg'] },
  { code: 'PE', name: 'Peru', aliases: ['per'] },
  { code: 'CO', name: 'Colombia', aliases: ['col'] },
  { code: 'JM', name: 'Jamaica', aliases: ['jam'] },
  { code: 'TT', name: 'Trinidad and Tobago', aliases: ['tto'] },
  { code: 'GY', name: 'Guyana', aliases: ['guy'] },
  { code: 'SR', name: 'Suriname', aliases: ['sur'] },
  { code: 'HT', name: 'Haiti', aliases: ['hti'] },
  { code: 'DO', name: 'Dominican Republic', aliases: ['dom'] },
];

const INDEX = new Map<string, SourceCountry>();
for (const country of SOURCE_COUNTRIES) {
  INDEX.set(country.code.toLowerCase(), country);
  INDEX.set(country.name.toLowerCase(), country);
  for (const alias of country.aliases) INDEX.set(alias.toLowerCase(), country);
}

export function resolveSourceCountry(raw: string | null | undefined): SourceCountry | null {
  const key = (raw || '').trim().toLowerCase();
  if (!key) return null;
  const known = INDEX.get(key);
  if (known) return known;
  if (/^[a-z]{2}$/.test(key)) {
    return { code: key.toUpperCase(), name: key.toUpperCase(), aliases: [] };
  }
  return null;
}

export function resolveSourceCountryFromRow(row: Record<string, string>): SourceCountry | null {
  return resolveSourceCountry(row.source_country_code) || resolveSourceCountry(row.source_country);
}

/** Regional-indicator flag emoji from an ISO-2 code (for public listings). */
export function countryFlagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function countryFlagImageUrl(code: string, width = 40): string {
  const cc = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return '';
  return `https://flagcdn.com/w${width}/${cc}.png`;
}
