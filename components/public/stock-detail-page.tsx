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
  listedVehicleCategory,
  publicEngineFromNotes,
  selectListedVehicles,
  sourceCountryCode,
  sourceCountryLabel,
  type PublicVehicle,
  type VehicleImageRow,
} from '@/lib/public/vehicles';
import { STOCK_CATALOGS, type StockCategory } from '@/lib/stock-category';
import { ArrowLeft, CarFront, Fuel, Gauge, Loader2, Palette, Settings2 } from 'lucide-react';

export function StockDetailPage({ category }: { category: StockCategory }) {
  const catalog = STOCK_CATALOGS[category];
  const params = useParams();
  const id = String(params?.id || '');
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await selectListedVehicles(supabase, { id, category });
      const row = (data as unknown as Omit<PublicVehicle, 'gallery'> | null) || null;
      if (!row || listedVehicleCategory(row) !== category) {
        setVehicle(null);
        setLoading(false);
        return;
      }
      const withRole = await supabase
        .from('vehicle_images')
        .select('vehicle_id, image_url, sort_order, is_primary, image_role')
        .eq('vehicle_id', id)
        .neq('image_role', 'auction_sheet');
      let galleryRows = (withRole.data || []) as VehicleImageRow[];
      if (withRole.error) {
        const fallback = await supabase
          .from('vehicle_images')
          .select('vehicle_id, image_url, sort_order, is_primary')
          .eq('vehicle_id', id);
        galleryRows = (fallback.data || []) as VehicleImageRow[];
      }
      const attached = attachGallery([row], galleryRows)[0];
      setVehicle(attached);
      setLoading(false);
    })();
  }, [id, category]);

  const engine = publicEngineFromNotes(vehicle?.notes);
  const source = vehicle ? sourceCountryLabel(vehicle) : 'Japan';
  const sourceCode = vehicle ? sourceCountryCode(vehicle) : 'jp';

  return (
    <PublicShell>
      <section className="jct-home-wrap py-10 pb-28 md:py-14 md:pb-14">
        <Link href={catalog.path} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--jct-muted)] hover:text-[var(--jct-navy)]">
          <ArrowLeft className="h-4 w-4" /> {catalog.backLabel}
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading {catalog.itemNoun}…
          </div>
        ) : !vehicle ? (
          <div className="mt-12 rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-[var(--jct-muted-2)]" />
            <p className="mt-3 font-medium text-[var(--jct-navy)]">Not available</p>
            <Link href={catalog.path} className="jct-btn-primary mt-5 px-5">
              Browse stock
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <VehicleGallery images={vehicle.gallery} alt={`${vehicle.make} ${vehicle.model}`} />

            <div className="space-y-4">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--jct-border)] bg-white px-2.5 py-1">
                    <CountryFlag country={source} code={sourceCode} size="sm" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--jct-navy)]">
                      {source}
                    </span>
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${
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
                  {category === 'parts' && vehicle.part_sku ? ` · ${vehicle.part_sku}` : ''}
                  {vehicle.model_year ? ` · ${vehicle.model_year}` : ''}
                </p>
              </div>

              <div className="jct-stock-panel jct-stock-panel-accent p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--jct-vermilion)]">FOB USD</p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-[var(--jct-navy)]">
                  {vehicle.listed_price != null
                    ? formatCurrency(vehicle.listed_price, vehicle.listed_currency || 'USD')
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

              <div className="hidden flex-wrap gap-3 pt-2 md:flex">
                <Link
                  href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
                  className="jct-btn-primary px-6"
                >
                  {catalog.inquireLabel}
                </Link>
                <Link href="/verify-agent" className="jct-btn-secondary px-6">
                  Verify agent
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {vehicle ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--jct-border)] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(11,31,51,0.12)] backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--jct-vermilion)]">FOB</p>
              <p className="truncate font-display text-lg font-bold text-[var(--jct-navy)]">
                {vehicle.listed_price != null
                  ? formatCurrency(vehicle.listed_price, vehicle.listed_currency || 'USD')
                  : 'Ask'}
              </p>
            </div>
            {process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? (
              <a
                href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I am interested in ${vehicle.stock_number}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--jct-navy)] px-4 text-sm font-semibold text-white"
            >
              Enquire
            </Link>
          </div>
        </div>
      ) : null}
    </PublicShell>
  );
}

function spec(label: string, value: string, Icon: typeof Gauge) {
  return (
    <div key={label} className="rounded-xl border border-[var(--jct-navy)]/12 bg-white p-3 shadow-[0_2px_12px_rgba(11,31,51,0.04)]">
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wider text-[var(--jct-muted-2)]">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className="mt-1 font-medium capitalize text-[var(--jct-navy)]">{value}</dd>
    </div>
  );
}
