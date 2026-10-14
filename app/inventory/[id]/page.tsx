'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { CountryFlag } from '@/components/public/country-flag';
import { PublicPriceEstimator } from '@/components/public/public-price-estimator';
import { VehicleGallery } from '@/components/public/vehicle-gallery';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currencies';
import {
  attachGallery,
  publicEngineFromNotes,
  selectListedVehicles,
  sourceCountryCode,
  sourceCountryLabel,
  type PublicVehicle,
  type VehicleImageRow,
} from '@/lib/public/vehicles';
import { ArrowLeft, CarFront, Fuel, Gauge, Loader2, Palette, Settings2 } from 'lucide-react';

export default function PublicVehicleDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await selectListedVehicles(supabase, { id });
      const row = (data as unknown as Omit<PublicVehicle, 'gallery'> | null) || null;
      if (!row) {
        setVehicle(null);
        setLoading(false);
        return;
      }
      const { data: gallery } = await supabase
        .from('vehicle_images')
        .select('vehicle_id, image_url, sort_order, is_primary')
        .eq('vehicle_id', id);
      const attached = attachGallery([row], (gallery || []) as VehicleImageRow[])[0];
      setVehicle(attached);
      setLoading(false);
    })();
  }, [id]);

  const engine = publicEngineFromNotes(vehicle?.notes);
  const source = vehicle ? sourceCountryLabel(vehicle) : 'Japan';
  const sourceCode = vehicle ? sourceCountryCode(vehicle) : 'jp';

  return (
    <PublicShell>
      <section className="jct-home-wrap py-10 md:py-14">
        <Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--jct-muted)] hover:text-[var(--jct-navy)]">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading vehicle…
          </div>
        ) : !vehicle ? (
          <div className="mt-12 rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-[var(--jct-muted-2)]" />
            <p className="mt-3 font-medium text-[var(--jct-navy)]">Vehicle not available</p>
            <Link href="/inventory" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-5 text-sm font-semibold text-white">
              Browse stock
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <VehicleGallery images={vehicle.gallery} alt={`${vehicle.make} ${vehicle.model}`} />

            <div className="space-y-6">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--jct-border)] bg-white px-2.5 py-1">
                    <CountryFlag country={source} code={sourceCode} size="sm" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--jct-navy)]">
                      {source}
                    </span>
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                      vehicle.status === 'in_stock'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {vehicle.status === 'in_stock' ? 'Available' : 'Reserved'}
                  </span>
                </div>
                <h1 className="font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">
                  {vehicle.make} {vehicle.model}
                  {vehicle.model_grade ? ` ${vehicle.model_grade}` : ''}
                </h1>
                <p className="mt-2 text-sm text-[var(--jct-muted)]">
                  {vehicle.stock_number}
                  {vehicle.model_year ? ` · ${vehicle.model_year}` : ''}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--jct-muted-2)]">FOB price</p>
                <p className="mt-1 font-display text-3xl font-bold text-[var(--jct-navy)]">
                  {vehicle.listed_price != null
                    ? formatCurrency(vehicle.listed_price, vehicle.listed_currency)
                    : 'Ask for quote'}
                </p>
                <p className="mt-2 text-xs text-[var(--jct-muted)]">C&amp;F / CIF on request · RORO or container</p>
              </div>

              <PublicPriceEstimator listedPrice={vehicle.listed_price} currency={vehicle.listed_currency || 'USD'} />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                {vehicle.model_year ? spec('Year', String(vehicle.model_year), Gauge) : null}
                {vehicle.color ? spec('Colour', vehicle.color, Palette) : null}
                {engine ? spec('Engine', engine, Settings2) : null}
                {vehicle.transmission ? spec('Transmission', vehicle.transmission, Settings2) : null}
                {vehicle.fuel_type ? spec('Fuel', vehicle.fuel_type, Fuel) : null}
                {vehicle.mileage_km != null ? spec('Mileage', `${vehicle.mileage_km.toLocaleString()} km`, Gauge) : null}
                {spec('Source country', source, CarFront)}
              </dl>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
                  className="inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-6 text-sm font-semibold text-white hover:bg-[#c23024]"
                >
                  Inquire about this vehicle
                </Link>
                <Link
                  href="/verify-agent"
                  className="inline-flex min-h-11 items-center rounded-lg border border-[var(--jct-navy)] px-6 text-sm font-medium text-[var(--jct-navy)]"
                >
                  Verify agent
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function spec(label: string, value: string, Icon: typeof Gauge) {
  return (
    <div key={label} className="rounded-xl border border-[var(--jct-border)] bg-white p-3">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--jct-muted-2)]">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-1 font-medium capitalize text-[var(--jct-navy)]">{value}</dd>
    </div>
  );
}
