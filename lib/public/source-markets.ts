import { resolveSourceCountry, type SourceCountry } from '@/lib/source-countries';

export type PublicSourceMarket = SourceCountry & {
  slug: string;
  tagline: string;
};

/** Featured source markets shown on the homepage and /source/[slug] pages. */
export const PUBLIC_SOURCE_MARKETS: PublicSourceMarket[] = [
  { code: 'JP', name: 'Japan', slug: 'japan', aliases: ['jpn', '日本'], tagline: 'Auction-grade stock from Nagoya' },
  { code: 'AE', name: 'United Arab Emirates', slug: 'uae', aliases: ['uae', 'dubai'], tagline: 'GCC-spec and re-export units' },
  { code: 'GB', name: 'United Kingdom', slug: 'uk', aliases: ['uk', 'britain'], tagline: 'Right-hand drive from the UK' },
  { code: 'US', name: 'United States', slug: 'usa', aliases: ['usa', 'america'], tagline: 'North American market vehicles' },
  { code: 'KE', name: 'Kenya', slug: 'kenya', aliases: ['ken'], tagline: 'East Africa sourcing hub' },
  { code: 'ZA', name: 'South Africa', slug: 'south-africa', aliases: ['rsa', 'zaf'], tagline: 'Southern Africa stock' },
];

const BY_SLUG = new Map(PUBLIC_SOURCE_MARKETS.map((m) => [m.slug.toLowerCase(), m]));
const BY_CODE = new Map(PUBLIC_SOURCE_MARKETS.map((m) => [m.code.toLowerCase(), m]));

export function resolvePublicSourceMarket(slugOrCode: string): PublicSourceMarket | null {
  const key = slugOrCode.trim().toLowerCase();
  return BY_SLUG.get(key) || BY_CODE.get(key) || null;
}

export function sourceMarketFromCountry(raw: string | null | undefined): PublicSourceMarket | null {
  const resolved = resolveSourceCountry(raw);
  if (!resolved) return null;
  return BY_CODE.get(resolved.code.toLowerCase()) || null;
}

export function sourceMarketPath(market: Pick<PublicSourceMarket, 'slug'>): string {
  return `/source/${market.slug}`;
}

export function inventoryQueryForSource(code: string): string {
  return `/inventory?country=${encodeURIComponent(code.toLowerCase())}`;
}
