import Link from 'next/link';
import { CATALOG_COUNTRIES } from '@/lib/public/catalog';

export function CountryList() {
  return (
    <section className="jct-home-wrap py-12 md:py-16">
      <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">Shipping to your country</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--jct-muted-2)]">
        Pick your destination to see how importing works and what we can ship.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG_COUNTRIES.map((country) => (
          <li key={country.iso2}>
            <Link
              href="/blog"
              className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[var(--jct-border)] bg-white px-3 py-3 hover:border-[var(--jct-navy)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              <img
                src={`/flags/${country.iso2}.svg`}
                alt=""
                aria-hidden="true"
                className="h-[39px] w-[52px] rounded-[5px] border border-[var(--jct-border)] object-cover"
              />
              <span>
                <span className="block font-semibold text-[var(--jct-navy)]">{country.name}</span>
                <span className="block text-sm text-[var(--jct-muted-2)]">Import guide</span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/blog"
            className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-[var(--jct-border)] px-3 py-3 text-sm font-semibold text-[var(--jct-navy)] hover:bg-[var(--jct-panel)]"
          >
            All countries
          </Link>
        </li>
      </ul>
    </section>
  );
}
