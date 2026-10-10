'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { PublicPriceEstimator } from '@/components/public/public-price-estimator';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currencies';
import { ArrowLeft, CarFront, Fuel, Gauge, Loader2, MapPin, Settings2 } from 'lucide-react';

type PublicVehicle = {
  id: string;
  stock_number: string;
  chassis_number: string;
  make: string;
  model: string;
  model_grade: string | null;
  model_year: number | null;
  registration_year: number | null;
  mileage_km: number | null;
  listed_price: number | null;
  listed_currency: string;
  transmission: string | null;
  fuel_type: string | null;
  color: string | null;
  status: string;
  primary_image_url: string | null;
  source_country: string | null;
  notes: string | null;
};

type GalleryRow = { image_url: string; is_primary: boolean | null; sort_order: number };

export default function PublicVehicleDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [vRes, gRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select(
            'id, stock_number, chassis_number, make, model, model_grade, model_year, registration_year, mileage_km, listed_price, listed_currency, transmission, fuel_type, color, status, primary_image_url, source_country, notes'
          )
          .eq('id', id)
          .in('status', ['in_stock', 'reserved'])
          .maybeSingle(),
        supabase
          .from('vehicle_images')
          .select('image_url, is_primary, sort_order')
          .eq('vehicle_id', id)
          .order('sort_order', { ascending: true }),
      ]);
      const v = (vRes.data as PublicVehicle) || null;
      setVehicle(v);
      const imgs = ((gRes.data || []) as GalleryRow[]).map((r) => r.image_url);
      if (imgs.length) setGallery(imgs);
      else if (v?.primary_image_url) setGallery([v.primary_image_url]);
      else setGallery([]);
      setActive(0);
      setLoading(false);
    })();
  }, [id]);

  return (
    <PublicShell>
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-10 md:py-14">
        <Link href="/inventory" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading vehicle…
          </div>
        ) : !vehicle ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-white font-medium">Vehicle not available</p>
            <Link href="/inventory" className="mt-5 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white">
              Browse stock
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="relative aspect-[16/11] rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
                {gallery[active] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gallery[active]} alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                    <CarFront className="h-16 w-16 text-zinc-600" />
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600">Photo coming soon</span>
                  </div>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gallery.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      onClick={() => setActive(i)}
                      className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border ${
                        i === active ? 'border-red-500 ring-1 ring-red-500' : 'border-white/10'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {vehicle.source_country && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-zinc-200">
                      <MapPin className="h-3 w-3" /> {vehicle.source_country}
                    </span>
                  )}
                  <span className={`text-[10px] uppercase tracking-wider rounded-full border px-2.5 py-1 font-medium ${
                    vehicle.status === 'in_stock'
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                  }`}>
                    {vehicle.status === 'in_stock' ? 'Available' : 'Reserved'}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {vehicle.make} {vehicle.model}
                  {vehicle.model_grade ? ` ${vehicle.model_grade}` : ''}
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                  {vehicle.stock_number}
                  {vehicle.model_year ? ` · ${vehicle.model_year}` : ''}
                  {vehicle.color ? ` · ${vehicle.color}` : ''}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">FOB price</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {vehicle.listed_price != null
                    ? formatCurrency(vehicle.listed_price, vehicle.listed_currency)
                    : 'Ask for quote'}
                </p>
                <p className="mt-2 text-xs text-zinc-500">C&F / CIF on request · RORO or container</p>
              </div>

              <PublicPriceEstimator listedPrice={vehicle.listed_price} currency={vehicle.listed_currency || 'USD'} />

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  vehicle.mileage_km != null && { icon: Gauge, label: 'Mileage', value: `${vehicle.mileage_km.toLocaleString()} km` },
                  vehicle.transmission && { icon: Settings2, label: 'Transmission', value: vehicle.transmission },
                  vehicle.fuel_type && { icon: Fuel, label: 'Fuel', value: vehicle.fuel_type },
                  vehicle.chassis_number && { icon: CarFront, label: 'Chassis', value: vehicle.chassis_number },
                ]
                  .filter(Boolean)
                  .map((item) => {
                    const it = item as { icon: typeof Gauge; label: string; value: string };
                    const Icon = it.icon;
                    return (
                      <div key={it.label} className="rounded-xl border border-white/10 bg-zinc-900/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                          <Icon className="h-3 w-3" /> {it.label}
                        </p>
                        <p className="mt-1 text-white font-medium capitalize">{it.value}</p>
                      </div>
                    );
                  })}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/contact?stock=${encodeURIComponent(vehicle.stock_number)}`}
                  className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Inquire about this vehicle
                </Link>
                <Link href="/verify-agent" className="rounded-full border border-emerald-500/40 px-6 py-3 text-sm font-medium text-emerald-300">
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
