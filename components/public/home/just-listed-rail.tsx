'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CountryFlag } from '@/components/public/country-flag';
import { formatCurrency } from '@/lib/utils/currencies';
import {
  coverPhoto,
  listedVehicleCategory,
  sourceCountryCode,
  sourceCountryLabel,
  type PublicVehicle,
} from '@/lib/public/vehicles';
import { STOCK_CATALOGS } from '@/lib/stock-category';

type Props = {
  vehicles: PublicVehicle[];
};

/**
 * Original JCT enhancement: horizontal “yard-fresh” rail so buyers scan
 * many real units quickly (export-site stock density) without a dense card wall.
 */
export function JustListedRail({ vehicles }: Props) {
  if (vehicles.length < 3) return null;

  return (
    <section
      className="jct-just-listed border-y border-[var(--jct-border)] bg-gradient-to-b from-white to-[var(--jct-panel)]"
      aria-labelledby="jct-just-listed-heading"
    >
      <div className="jct-home-wrap py-10 md:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--jct-vermilion)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Yard-fresh
            </p>
            <h2
              id="jct-just-listed-heading"
              className="mt-1.5 font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl"
            >
              Just listed from Nagoya
            </h2>
            <p className="mt-1 text-sm text-[var(--jct-muted-2)]">
              Newly available export units — swipe to browse, tap for details and FOB pricing.
            </p>
          </div>
          <Link
            href="/inventory"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--jct-vermilion)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
          >
            Open full stock
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="jct-rail-fade relative">
          <ul
            className="jct-just-listed-track flex gap-4 overflow-x-auto pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory md:gap-5 [&::-webkit-scrollbar]:hidden"
            role="list"
          >
            {vehicles.map((vehicle, index) => {
              const title = [vehicle.model_year, vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(' ');
              const photo = coverPhoto(vehicle);
              const source = sourceCountryLabel(vehicle);
              const href = `${STOCK_CATALOGS[listedVehicleCategory(vehicle)].path}/${vehicle.id}`;

              return (
                <li
                  key={vehicle.id}
                  className="jct-rail-item w-[78vw] max-w-[280px] shrink-0 snap-start sm:w-[240px]"
                  style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                >
                  <Link
                    href={href}
                    className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--jct-border)] bg-white shadow-[0_8px_28px_rgba(20,24,28,0.08)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--jct-navy)] hover:shadow-[0_16px_40px_rgba(20,24,28,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
                  >
                    <span className="relative block aspect-[16/10] bg-[var(--jct-panel)]">
                      {photo ? (
                        <Image
                          src={photo}
                          alt={title}
                          fill
                          sizes="280px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-[var(--jct-muted-2)]">
                          Photos soon
                        </span>
                      )}
                      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 shadow-sm backdrop-blur-sm">
                        <CountryFlag
                          country={source}
                          code={sourceCountryCode(vehicle)}
                          size="sm"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--jct-navy)]">
                          {source}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                      <span className="truncate font-display text-sm font-semibold text-[var(--jct-navy)] group-hover:text-[var(--jct-vermilion)]">
                        {title}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-[var(--jct-muted-2)]">
                        {vehicle.stock_number}
                      </span>
                      <span className="mt-auto font-display text-lg font-bold tracking-tight text-[var(--jct-navy)]">
                        {vehicle.listed_price != null
                          ? formatCurrency(
                              vehicle.listed_price,
                              vehicle.listed_currency || 'USD'
                            )
                          : 'Ask'}
                        {vehicle.listed_price != null ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--jct-gold,#C4A35A)]">
                            FOB
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
