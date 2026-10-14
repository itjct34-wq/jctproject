'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { CountryFlag } from '@/components/public/country-flag';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { supabase } from '@/lib/supabase/client';
import {
  attachGallery,
  groupVehiclesBySource,
  selectListedVehicles,
  sourceCountryCode,
  sourceCountryLabel,
  type PublicVehicle,
  type VehicleImageRow,
} from '@/lib/public/vehicles';
import { CarFront, Loader2, Search } from 'lucide-react';

export default function InventoryPage() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await selectListedVehicles(supabase, { limit: 96 });
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as unknown as Omit<PublicVehicle, 'gallery'>[];
      const ids = rows.map((row) => row.id);
      let images: VehicleImageRow[] = [];
      if (ids.length) {
        const { data: gallery } = await supabase
          .from('vehicle_images')
          .select('vehicle_id, image_url, sort_order, is_primary')
          .in('vehicle_id', ids);
        images = (gallery || []) as VehicleImageRow[];
      }
      setVehicles(attachGallery(rows, images));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const makeParam = params.get('make');
    const qParam = params.get('q');
    const countryParam = params.get('country');
    if (qParam) setQ(qParam);
    if (countryParam) setCountry(countryParam);
    if (!makeParam) return;
    const match = vehicles.find((v) => v.make.toLowerCase() === makeParam.toLowerCase());
    setMakeFilter(match?.make || makeParam);
  }, [vehicles]);

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vehicles) {
      const key = sourceCountryCode(v);
      if (!map.has(key)) map.set(key, sourceCountryLabel(v));
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [vehicles]);

  const makes = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.make).filter(Boolean));
    return Array.from(set).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (country !== 'all') {
        const code = sourceCountryCode(v);
        const label = sourceCountryLabel(v).toLowerCase();
        if (code !== country.toLowerCase() && label !== country.toLowerCase()) return false;
      }
      if (makeFilter !== 'all' && v.make.toLowerCase() !== makeFilter.toLowerCase()) return false;
      if (!term) return true;
      return [v.make, v.model, v.stock_number, v.color, v.source_country, String(v.model_year || '')]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term));
    });
  }, [vehicles, q, country, makeFilter]);

  const groups = useMemo(() => groupVehiclesBySource(filtered), [filtered]);

  const field =
    'h-11 w-full rounded-xl border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)] outline-none focus:ring-2 focus:ring-[var(--jct-vermilion)]/25';

  return (
    <PublicShell>
      <section className="jct-home-wrap py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">Global stock</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">Vehicles for export</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--jct-muted)]">
              Browse stock grouped by source country. Photos come from the vehicle gallery. Inquire for FOB / C&amp;F / CIF.
            </p>
          </div>
          <p className="shrink-0 text-sm text-[var(--jct-muted-2)]">
            {loading ? '…' : (
              <>
                <span className="font-semibold text-[var(--jct-navy)]">{filtered.length}</span> of {vehicles.length} available
              </>
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCountry('all')}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm ${
              country === 'all'
                ? 'border-[var(--jct-navy)] bg-[var(--jct-navy)] text-white'
                : 'border-[var(--jct-border)] bg-white text-[var(--jct-navy)]'
            }`}
          >
            All origins
          </button>
          {countries.map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setCountry(code)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm ${
                country === code
                  ? 'border-[var(--jct-navy)] bg-[var(--jct-panel)] font-medium text-[var(--jct-navy)]'
                  : 'border-[var(--jct-border)] bg-white text-[var(--jct-navy)]'
              }`}
            >
              <CountryFlag country={label} code={code} size="sm" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--jct-muted-2)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search make, model, stock #…"
              className={`${field} pl-10`}
            />
          </div>
          <select value={makeFilter} onChange={(e) => setMakeFilter(e.target.value)} className={`${field} sm:w-48`}>
            <option value="all">All makes</option>
            {makeFilter !== 'all' && !makes.includes(makeFilter) && (
              <option value={makeFilter}>{makeFilter}</option>
            )}
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-[var(--jct-muted-2)]" />
            <p className="mt-3 font-medium text-[var(--jct-navy)]">No matching vehicles</p>
            <p className="mt-1 text-sm text-[var(--jct-muted)]">Try clearing filters or contact us for sourcing.</p>
            <Link href="/contact" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-5 text-sm font-semibold text-white">
              Request sourcing
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-4 flex items-center gap-3">
                  <CountryFlag country={group.label} code={group.key} size="md" />
                  <h2 className="font-display text-xl font-semibold text-[var(--jct-navy)]">
                    {group.label}
                    <span className="ml-2 text-sm font-normal text-[var(--jct-muted-2)]">{group.items.length}</span>
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
