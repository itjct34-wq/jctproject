import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currencies';
import type { HomeVehicle } from '@/lib/public/home-data';

function specLine(vehicle: HomeVehicle): string {
  return [
    vehicle.mileage_km != null ? `${vehicle.mileage_km.toLocaleString()} km` : null,
    vehicle.transmission,
    vehicle.fuel_type,
  ]
    .filter(Boolean)
    .join(' · ');
}

function isNewArrival(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 14 * 24 * 60 * 60 * 1000;
}

export function VehicleCard({ vehicle }: { vehicle: HomeVehicle }) {
  const title = [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const specs = specLine(vehicle);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-white">
      <Link href={`/inventory/${vehicle.id}`} className="relative block aspect-[3/2] bg-[var(--jct-panel)]">
        {vehicle.primary_image_url ? (
          <img
            src={vehicle.primary_image_url}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-[var(--jct-muted-2)]">
            Photos coming soon
          </span>
        )}
        {isNewArrival(vehicle.created_at) && (
          <span className="absolute left-3 top-3 rounded-md bg-[var(--jct-vermilion)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            New
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold text-[var(--jct-navy)]">{title}</h3>
        {specs ? <p className="mt-1 text-sm text-[var(--jct-muted-2)]">{specs}</p> : null}
        <p className="mt-3 text-sm text-[var(--jct-muted)]">FOB Japan</p>
        <p className="font-display text-lg font-semibold text-[var(--jct-navy)]">
          {vehicle.listed_price != null ? formatCurrency(vehicle.listed_price, vehicle.listed_currency) : 'Ask for price'}
        </p>
        <Link
          href={`/inventory/${vehicle.id}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--jct-navy)] px-4 text-sm font-semibold text-[var(--jct-navy)] hover:bg-[var(--jct-panel)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
        >
          Get delivered price
        </Link>
      </div>
    </article>
  );
}
