'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currencies';
import { CarFront, Fuel, Gauge, Loader2, MapPin, Search, Settings2 } from 'lucide-react';

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
  source_country: string | null;
};

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('vehicles')
        .select(
          'id, stock_number, make, model, model_year, mileage_km, listed_price, listed_currency, transmission, fuel_type, color, status, primary_image_url, source_country'
        )
        .in('status', ['in_stock', 'reserved'])
        .order('updated_at', { ascending: false })
        .limit(96);
      setVehicles((data || []) as PublicVehicle[]);
      setLoading(false);
    })();
  }, []);

  const countries = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.source_country).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [vehicles]);

  const makes = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.make).filter(Boolean));
    return Array.from(set).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (country !== 'all' && v.source_country !== country) return false;
      if (makeFilter !== 'all' && v.make !== makeFilter) return false;
      if (!term) return true;
      return [v.make, v.model, v.stock_number, v.color, v.source_country, String(v.model_year || '')]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term));
    });
  }, [vehicles, q, country, makeFilter]);

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Global stock</p>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">Vehicles for export</h1>
            <p className="mt-3 text-sm text-zinc-400 max-w-2xl">
              Browse verified Japan Circular Trading stock — then inquire for FOB / C&F / CIF quotes and shipping.
            </p>
          </div>
          <p className="text-sm text-zinc-500 shrink-0">
            {loading ? '…' : (
              <>
                <span className="text-white font-semibold">{filtered.length}</span> of {vehicles.length} available
              </>
            )}
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search make, model, stock #…"
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
          </div>
          <select
            value={makeFilter}
            onChange={(e) => setMakeFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All makes</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All origins</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-white font-medium">No matching vehicles</p>
            <p className="mt-1 text-sm text-zinc-500">Try clearing filters or contact us for sourcing.</p>
            <Link href="/contact" className="mt-5 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500">
              Request sourcing
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <Link key={v.id} href={`/inventory/${v.id}`} className="block group">
                <article className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden hover:border-red-500/40 hover:shadow-lg hover:shadow-red-900/20 transition-all duration-300 h-full">
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
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {v.source_country && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-zinc-200 backdrop-blur-sm">
                          <MapPin className="h-2.5 w-2.5" />
                          {v.source_country}
                        </span>
                      )}
                    </div>
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
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">FOB</p>
                        <p className="text-xl font-bold text-white">
                          {v.listed_price != null
                            ? formatCurrency(v.listed_price, v.listed_currency)
                            : 'Ask for quote'}
                        </p>
                      </div>
                      <span className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white group-hover:bg-red-500 transition-colors">
                        View details
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
