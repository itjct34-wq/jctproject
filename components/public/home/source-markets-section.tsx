import Link from 'next/link';
import { CountryFlag } from '@/components/public/country-flag';
import { PUBLIC_SOURCE_MARKETS, sourceMarketPath } from '@/lib/public/source-markets';

export function SourceMarketsSection() {
  return (
    <section id="source-markets" className="jct-home-wrap py-12 md:py-16">
      <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">Stock by source country</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--jct-muted-2)]">
        Browse vehicles grouped by where they are sourced. More markets are added as stock is uploaded.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PUBLIC_SOURCE_MARKETS.map((market) => (
          <li key={market.code}>
            <Link
              href={sourceMarketPath(market)}
              className="flex min-h-[88px] items-center gap-3 rounded-[var(--radius)] border border-[var(--jct-border)] bg-white px-4 py-3 transition hover:border-[var(--jct-canopy)] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              <CountryFlag country={market.name} code={market.code} size="lg" />
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--jct-navy)]">{market.name}</span>
                <span className="block text-sm text-[var(--jct-muted-2)]">{market.tagline}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
