'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { CountryFlag } from '@/components/public/country-flag';
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
      <section className="jct-home-wrap min-w-0 overflow-x-clip py-10 pb-28 md:py-14 md:pb-14">
        <Link href={catalog.path} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--jct-muted)] hover:text-[var(--jct-navy)]">
          <ArrowLeft className="h-4 w-4 shrink-0" /> {catalog.backLabel}
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
          <div className="mt-5 grid min-w-0 items-start gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="min-w-0 max-w-full space-y-5">
              <VehicleGallery images={vehicle.gallery} alt={`${vehicle.make} ${vehicle.model}`} />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-[var(--jct-navy)]">Specifications</h2>
                <dl className="mt-3 grid grid-cols-2 gap-2.5 text-sm sm:gap-3 md:grid-cols-3">
                  {vehicle.model_year ? spec('Year', String(vehicle.model_year), Gauge) : null}
                  {spec('Make / Model', `${vehicle.make} ${vehicle.model}`, CarFront)}
                  {vehicle.color ? spec('Colour', vehicle.color, Palette) : null}
                  {engine ? spec('Engine', engine, Settings2) : null}
                  {vehicle.transmission ? spec('Transmission', vehicle.transmission, Settings2) : null}
                  {vehicle.fuel_type ? spec('Fuel', vehicle.fuel_type, Fuel) : null}
                  {vehicle.mileage_km != null
                    ? spec('Mileage', `${vehicle.mileage_km.toLocaleString()} km`, Gauge)
                    : null}
                  {spec('Source country', source, CarFront)}
                </dl>
              </div>
            </div>

            <aside className="min-w-0 max-w-full space-y-4 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[var(--jct-border)] bg-white p-4 shadow-[0_4px_18px_rgba(11,31,51,0.06)] sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--jct-border)] bg-[var(--jct-panel)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--jct-navy)]">
                    {vehicle.stock_number}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      vehicle.status === 'in_stock'
                        ? 'bg-[#E6F5EE] text-[#1B6B45]'
                        : 'bg-[#FCE8E8] text-[#9B1C1C]'
                    }`}
                  >
                    {vehicle.status === 'in_stock' ? 'In stock' : 'Reserved'}
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <CountryFlag country={source} code={sourceCode} size="sm" />
                  <span className="text-xs font-medium text-[var(--jct-muted)]">{source}</span>
                </div>
                <h1 className="break-words font-display text-2xl font-bold text-[var(--jct-navy)] md:text-[1.75rem]">
                  {vehicle.make} {vehicle.model}
                  {vehicle.model_grade ? ` ${vehicle.model_grade}` : ''}
                </h1>
                <p className="mt-1 break-words text-sm text-[var(--jct-muted)]">
                  {[vehicle.model_year, vehicle.transmission, vehicle.fuel_type].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--jct-muted-2)]">
                  FOB Nagoya
                </p>
                <p className="mt-1 break-words font-display text-[1.875rem] font-bold leading-tight tracking-tight text-[var(--jct-navy)] sm:text-[2.375rem] sm:leading-none">
                  {vehicle.listed_price != null
                    ? formatCurrency(vehicle.listed_price, vehicle.listed_currency || 'USD')
                    : 'Ask for quote'}
                </p>
                <div className="mt-5 hidden flex-col gap-2 md:flex">
                  <Link
                    href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--jct-vermilion)] text-sm font-semibold text-white"
                  >
                    Request quotation
                  </Link>
                  {process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? (
                    <a
                      href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I am interested in ${vehicle.stock_number}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--jct-border)] text-sm font-semibold text-[var(--jct-navy)]"
                    >
                      Ask on WhatsApp
                    </a>
                  ) : (
                    <Link
                      href="/verify-agent"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--jct-border)] text-sm font-semibold text-[var(--jct-navy)]"
                    >
                      Verify agent
                    </Link>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                Verified company account — pay only to bank details on your official invoice.
              </div>
            </aside>
          </div>
        )}
      </section>

      {vehicle ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--jct-border)] bg-white/95 px-3 py-3 shadow-[0_-8px_30px_rgba(11,31,51,0.12)] backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg min-w-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--jct-vermilion)]">FOB</p>
              <p className="truncate font-display text-base font-bold text-[var(--jct-navy)] sm:text-lg">
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
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-3.5 text-sm font-semibold text-white sm:px-4"
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[var(--jct-navy)] px-3.5 text-sm font-semibold text-white sm:px-4"
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
    <div
      key={label}
      className="min-w-0 rounded-xl border border-[var(--jct-navy)]/12 bg-white p-2.5 shadow-[0_2px_12px_rgba(11,31,51,0.04)] sm:p-3"
    >
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-[var(--jct-muted-2)] sm:text-xs">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 break-words font-medium capitalize text-[var(--jct-navy)]">{value}</dd>
    </div>
  );
}
