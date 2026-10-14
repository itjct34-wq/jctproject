import Link from 'next/link';
import { makeMonogram } from '@/lib/public/catalog';
import type { HomeMakeRow } from '@/lib/public/home-data';

export function MakeList({ makes }: { makes: HomeMakeRow[] }) {
  return (
    <section className="jct-home-wrap py-12 md:py-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">Shop by make</h2>
          <p className="mt-1 text-sm text-[var(--jct-muted-2)]">Cars, trucks and machinery in stock</p>
        </div>
        <Link
          href="/inventory"
          className="text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
        >
          All cars
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {makes.map((make) => (
          <li key={make.slug}>
            <Link
              href={`/inventory?make=${encodeURIComponent(make.name)}`}
              className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[var(--jct-border)] bg-white px-3 py-3 hover:border-[var(--jct-navy)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              <span className="flex h-12 w-[72px] shrink-0 items-center justify-center rounded-md bg-[var(--jct-panel)]">
                {make.logoPath ? (
                  <img src={make.logoPath} alt="" aria-hidden="true" className="max-h-10 max-w-[64px] object-contain" />
                ) : (
                  <span className="font-display text-sm font-semibold text-[var(--jct-muted)]" aria-hidden="true">
                    {makeMonogram(make.name)}
                  </span>
                )}
              </span>
              <span>
                <span className="block font-semibold text-[var(--jct-navy)]">{make.name}</span>
                <span className="block text-sm text-[var(--jct-muted-2)]">
                  {make.cars} {make.cars === 1 ? 'car' : 'cars'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
