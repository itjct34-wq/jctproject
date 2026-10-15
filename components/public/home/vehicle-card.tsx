import Link from 'next/link';
import { CountryFlag } from '@/components/public/country-flag';
import { formatCurrency } from '@/lib/utils/currencies';
import { coverPhoto, listedVehicleCategory, sourceCountryCode, sourceCountryLabel, type PublicVehicle } from '@/lib/public/vehicles';
import { STOCK_CATALOGS } from '@/lib/stock-category';

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

export function VehicleCard({ vehicle, hrefBase }: { vehicle: PublicVehicle; hrefBase?: string }) {
  const title = [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const specs = specLine(vehicle);
  const source = sourceCountryLabel(vehicle);
  const photo = coverPhoto(vehicle);
  const href = `${hrefBase || STOCK_CATALOGS[listedVehicleCategory(vehicle)].path}/${vehicle.id}`;

  return (
    <article className="jct-stock-card group flex h-full flex-col">
      <Link href={href} className="relative block aspect-[3/2] bg-[var(--jct-panel)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-[var(--jct-muted-2)]">
            Photos coming soon
          </span>
        )}
        <span className="absolute left-3 top-4 z-[2] inline-flex items-center gap-1.5 rounded-full border border-[var(--jct-navy)]/15 bg-white/95 px-2.5 py-1 shadow-[0_2px_10px_rgba(11,31,51,0.12)] backdrop-blur-sm">
          <CountryFlag country={source} code={sourceCountryCode(vehicle)} size="sm" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jct-navy)]">{source}</span>
        </span>
        {vehicle.status === 'reserved' ? (
          <span className="absolute right-3 top-4 z-[2] rounded-full border border-amber-600/30 bg-amber-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            Reserved
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4 pt-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--jct-muted-2)]">{vehicle.stock_number}</p>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-[var(--jct-navy)] transition-colors group-hover:text-[var(--jct-vermilion)]">
          {title}
        </h3>
        {vehicle.model_year ? (
          <p className="mt-0.5 text-sm text-[var(--jct-muted)]">Year {vehicle.model_year}</p>
        ) : null}
        {specs ? <p className="mt-1 line-clamp-2 text-sm text-[var(--jct-muted-2)]">{specs}</p> : null}
        <div className="jct-stock-panel-accent mt-4 rounded-lg border border-[var(--jct-border)] bg-gradient-to-br from-[var(--jct-panel)]/80 to-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-vermilion)]">FOB Japan</p>
          <p className="mt-0.5 font-display text-xl font-bold tracking-tight text-[var(--jct-navy)]">
            {vehicle.listed_price != null ? formatCurrency(vehicle.listed_price, vehicle.listed_currency) : 'Ask for price'}
          </p>
        </div>
        <Link
          href={href}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border-2 border-[var(--jct-navy)] bg-[var(--jct-navy)] px-5 text-sm font-semibold text-white transition-colors hover:border-[#b83226] hover:bg-[var(--jct-vermilion)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
