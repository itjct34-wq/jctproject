import Link from 'next/link';
import { CountryFlag } from '@/components/public/country-flag';
import { formatCurrency } from '@/lib/utils/currencies';
import { coverPhoto, sourceCountryCode, sourceCountryLabel, type PublicVehicle } from '@/lib/public/vehicles';

function specLine(vehicle: PublicVehicle): string {
  return [
    vehicle.mileage_km != null ? `${vehicle.mileage_km.toLocaleString()} km` : null,
    vehicle.transmission,
    vehicle.fuel_type,
    vehicle.color,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function VehicleCard({ vehicle }: { vehicle: PublicVehicle }) {
  const title = [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const specs = specLine(vehicle);
  const source = sourceCountryLabel(vehicle);
  const photo = coverPhoto(vehicle);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-white">
      <Link href={`/inventory/${vehicle.id}`} className="relative block aspect-[3/2] bg-[var(--jct-panel)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-[var(--jct-muted-2)]">
            Photos coming soon
          </span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2 py-1 shadow-sm">
          <CountryFlag country={source} code={sourceCountryCode(vehicle)} size="sm" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jct-navy)]">{source}</span>
        </span>
        {vehicle.status === 'reserved' ? (
          <span className="absolute right-3 top-3 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Reserved
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-[var(--jct-muted-2)]">{vehicle.stock_number}</p>
        <h3 className="mt-1 font-display text-base font-semibold text-[var(--jct-navy)]">{title}</h3>
        {vehicle.model_year ? (
          <p className="mt-0.5 text-sm text-[var(--jct-muted)]">Year {vehicle.model_year}</p>
        ) : null}
        {specs ? <p className="mt-1 text-sm text-[var(--jct-muted-2)]">{specs}</p> : null}
        <p className="mt-3 text-sm text-[var(--jct-muted)]">FOB Japan</p>
        <p className="font-display text-lg font-semibold text-[var(--jct-navy)]">
          {vehicle.listed_price != null ? formatCurrency(vehicle.listed_price, vehicle.listed_currency) : 'Ask for price'}
        </p>
        <Link
          href={`/inventory/${vehicle.id}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--jct-navy)] px-4 text-sm font-semibold text-[var(--jct-navy)] hover:bg-[var(--jct-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
