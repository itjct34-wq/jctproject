'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';
import { CarFront, Fuel, Gauge, Loader2, Settings2 } from 'lucide-react';

type PublicVehicle = {
  id: string;
  stock_number: string;
  make: string;
  model: string;
  model_year: number | null;
  mileage_km: number | null;
  listed_price: number | null;
  listed_currency: string;
  transmission: string | null;
  fuel_type: string | null;
  color: string | null;
  status: string;
  primary_image_url: string | null;
};

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, stock_number, make, model, model_year, mileage_km, listed_price, listed_currency, transmission, fuel_type, color, status, primary_image_url'
        )
        .in('status', ['in_stock', 'reserved'])
        .order('updated_at', { ascending: false })
        .limit(48);
      setVehicles((data || []) as PublicVehicle[]);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Stock</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">Available inventory</h1>
        <p className="mt-3 text-sm text-zinc-400 max-w-2xl">
          Live units from our Nagoya yard and partner stock. Prices are indicative — contact us for locked quotes and freight.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
          </div>
        ) : vehicles.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-white font-medium">Stock list updating</p>
            <p className="mt-1 text-sm text-zinc-500">Contact us for current auction and yard availability.</p>
            <Link
              href="/contact"
              className="mt-5 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500"
            >
              Request availability
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <article
                key={v.id}
                className="group rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden hover:border-red-500/40 hover:shadow-lg hover:shadow-red-900/20 transition-all duration-300"
              >
                <div className="relative aspect-[16/10] bg-zinc-950 overflow-hidden">
                  {v.primary_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.primary_image_url}
                      alt={`${v.make} ${v.model}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-2">
                      <CarFront className="h-14 w-14 text-zinc-600" />
                      <span className="text-[10px] uppercase tracking-widest text-zinc-600">Photo coming soon</span>
                    </div>
                  )}
                  <span
                    className={`absolute top-3 right-3 text-[10px] uppercase tracking-wider rounded-full border px-2.5 py-1 font-medium backdrop-blur-sm ${
                      v.status === 'in_stock'
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {v.status === 'in_stock' ? 'Available' : 'Reserved'}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h2 className="font-semibold text-white text-lg leading-tight">
                      {v.make} {v.model}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {v.stock_number}
                      {v.model_year ? ` · ${v.model_year}` : ''}
                      {v.color ? ` · ${v.color}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                    {v.mileage_km != null && (
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {v.mileage_km.toLocaleString()} km
                      </span>
                    )}
                    {v.transmission && (
                      <span className="inline-flex items-center gap-1">
                        <Settings2 className="h-3 w-3" />
                        {v.transmission}
                      </span>
                    )}
                    {v.fuel_type && (
                      <span className="inline-flex items-center gap-1">
                        <Fuel className="h-3 w-3" />
                        {v.fuel_type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end justify-between pt-1 border-t border-white/5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Price</p>
                      <p className="text-xl font-bold text-white">
                        {v.listed_price != null
                          ? formatMoney(v.listed_price, v.listed_currency)
                          : 'Ask for price'}
                      </p>
                    </div>
                    <Link
                      href={`/contact?stock=${encodeURIComponent(v.stock_number)}`}
                      className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
                    >
                      Inquire
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
