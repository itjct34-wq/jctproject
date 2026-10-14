import Link from 'next/link';
import { CountryFlag } from '@/components/public/country-flag';
import { DESTINATION_COUNTRIES } from '@/lib/public/countries';

export function CountryList() {
  return (
    <section className="jct-home-wrap py-12 md:py-16">
      <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">Shipping to your country</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--jct-muted-2)]">
        Pick your destination to see stock and how importing works.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DESTINATION_COUNTRIES.map((country) => (
          <li key={country.iso2}>
            <Link
              href="/inventory"
              className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[var(--jct-border)] bg-white px-3 py-3 hover:border-[var(--jct-navy)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              <CountryFlag country={country.name} size="lg" />
              <span>
                <span className="block font-semibold text-[var(--jct-navy)]">{country.name}</span>
                <span className="block text-sm text-[var(--jct-muted-2)]">{country.port || 'Import guide'}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
