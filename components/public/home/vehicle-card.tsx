'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Cog, Fuel, Gauge, Heart } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const SAVED_KEY = 'jct-saved-vehicles';

function readSaved(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function VehicleCard({ vehicle, hrefBase }: { vehicle: PublicVehicle; hrefBase?: string }) {
  const title = [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const source = sourceCountryLabel(vehicle);
  const photo = coverPhoto(vehicle);
  const href = `${hrefBase || STOCK_CATALOGS[listedVehicleCategory(vehicle)].path}/${vehicle.id}`;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSaved().has(vehicle.id));
  }, [vehicle.id]);

  const toggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = readSaved();
    if (next.has(vehicle.id)) next.delete(vehicle.id);
    else next.add(vehicle.id);
    localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
    setSaved(next.has(vehicle.id));
  };

  const specs = [
    vehicle.mileage_km != null
      ? { icon: Gauge, label: `${vehicle.mileage_km.toLocaleString()} km` }
      : null,
    vehicle.transmission ? { icon: Cog, label: vehicle.transmission } : null,
    vehicle.fuel_type ? { icon: Fuel, label: vehicle.fuel_type } : null,
    vehicle.model_year ? { icon: Calendar, label: String(vehicle.model_year) } : null,
  ].filter(Boolean) as Array<{ icon: typeof Gauge; label: string }>;

  return (
    <article className="jct-stock-card group flex h-full flex-col">
      <Link href={href} className="relative block aspect-[4/3] bg-[var(--jct-panel)]">
        {photo ? (
          <Image
            src={photo}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-[var(--jct-muted-2)]">
            Photos coming soon
          </span>
        )}
        <span className="absolute left-3 top-3 z-[2] inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--jct-border)] bg-white px-2.5 py-1 shadow-sm">
          <CountryFlag country={source} code={sourceCountryCode(vehicle)} size="sm" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--jct-navy)]">
            {source}
          </span>
        </span>
        <button
          type="button"
          aria-label={saved ? 'Remove from saved' : 'Save vehicle'}
          onClick={toggleSave}
          className={cn(
            'absolute right-3 top-3 z-[2] flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border bg-white shadow-sm transition-colors',
            saved
              ? 'border-[var(--jct-vermilion)]/40 text-[var(--jct-vermilion)]'
              : 'border-[var(--jct-border)] text-[var(--jct-navy)]'
          )}
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden />
        </button>
        <span
          className={cn(
            'absolute bottom-3 left-3 z-[2] rounded-[var(--radius)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-sm',
            vehicle.status === 'reserved'
              ? 'bg-[#FCE8E8] text-[#9B1C1C]'
              : vehicle.status === 'in_transit' || vehicle.status === 'exported'
                ? 'bg-[#E8F4FB] text-[#0B6A94]'
                : 'bg-[#E6F5EE] text-[#1B6B45]'
          )}
        >
          {vehicle.status === 'reserved'
            ? 'Reserved'
            : vehicle.status === 'in_transit'
              ? 'In transit'
              : vehicle.status === 'exported'
                ? 'Exported'
                : 'In stock'}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--jct-muted-2)]">
          {vehicle.stock_number}
        </p>
        <h3 className="mt-0.5 font-display text-base font-semibold leading-snug text-[var(--jct-navy)] transition-colors group-hover:text-[var(--jct-vermilion)]">
          {title}
        </h3>
        {specs.length > 0 ? (
          <ul className="mt-2 grid grid-cols-2 gap-1.5">
            {specs.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-1.5 text-xs text-[var(--jct-muted)]"
              >
                <s.icon className="h-4 w-4 shrink-0 text-[var(--jct-muted-2)]" aria-hidden />
                <span className="truncate">{s.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="jct-stock-panel-accent mt-2.5 rounded-[var(--radius)] border border-[var(--jct-border)] bg-[var(--jct-surface)] px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--jct-vermilion)]">
            FOB USD
          </p>
          <p className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[var(--jct-navy)]">
            {vehicle.listed_price != null
              ? formatCurrency(vehicle.listed_price, vehicle.listed_currency || 'USD')
              : 'Ask for price'}
          </p>
        </div>
        <Link
          href={href}
          className="mt-2.5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border-2 border-[var(--jct-navy)] bg-[var(--jct-navy)] px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors active:scale-[0.97] hover:border-[var(--jct-vermilion)] hover:bg-[var(--jct-vermilion)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
