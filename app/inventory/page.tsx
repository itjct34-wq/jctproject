'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';
import { CarFront, Loader2 } from 'lucide-react';

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
  status: string;
};

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('id, stock_number, make, model, model_year, mileage_km, listed_price, listed_currency, transmission, fuel_type, status')
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
            <Link href="/contact" className="mt-5 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500">
              Request availability
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <div key={v.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden hover:border-red-500/30 transition-colors">
                <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                  <CarFront className="h-12 w-12 text-zinc-600" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-white">{v.make} {v.model}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {v.stock_number}{v.model_year ? ` · ${v.model_year}` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                      {v.status === 'in_stock' ? 'Available' : 'Reserved'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    {v.mileage_km != null && <span>{v.mileage_km.toLocaleString()} km</span>}
                    {v.transmission && <span>· {v.transmission}</span>}
                    {v.fuel_type && <span>· {v.fuel_type}</span>}
                  </div>
                  <p className="mt-3 text-lg font-bold text-white">
                    {v.listed_price != null ? formatMoney(v.listed_price, v.listed_currency) : 'Ask for price'}
                  </p>
                  <Link href="/contact" className="mt-3 inline-block text-sm text-red-400 hover:text-red-300">
                    Inquire →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
