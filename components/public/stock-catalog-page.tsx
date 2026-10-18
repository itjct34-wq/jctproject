'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { supabase } from '@/lib/supabase/client';
import {
  attachGallery,
  selectListedVehicles,
  sourceCountryCode,
  sourceCountryLabel,
  type PublicVehicle,
  type VehicleImageRow,
} from '@/lib/public/vehicles';
import { STOCK_CATALOGS, type StockCategory } from '@/lib/stock-category';
import { CarFront, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StockCatalogPage({ category }: { category: StockCategory }) {
  const catalog = STOCK_CATALOGS[category];
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [makeFilter, setMakeFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('');
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [fuel, setFuel] = useState('all');
  const [transmission, setTransmission] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await selectListedVehicles(supabase, { limit: 500, category });
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as unknown as Omit<PublicVehicle, 'gallery'>[];
      const ids = rows.map((row) => row.id);
      let images: VehicleImageRow[] = [];
      if (ids.length) {
        const withRole = await supabase
          .from('vehicle_images')
          .select('vehicle_id, image_url, sort_order, is_primary, image_role')
          .in('vehicle_id', ids)
          .neq('image_role', 'auction_sheet');
        if (!withRole.error && withRole.data) {
          images = withRole.data as VehicleImageRow[];
        } else {
          const fallback = await supabase
            .from('vehicle_images')
            .select('vehicle_id, image_url, sort_order, is_primary')
            .in('vehicle_id', ids);
          images = (fallback.data || []) as VehicleImageRow[];
        }
      }
      setVehicles(attachGallery(rows, images));
      setLoading(false);
    })();
  }, [category]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const makeParam = params.get('make');
    const modelParam = params.get('model');
    const qParam = params.get('q');
    const countryParam = params.get('country');
    const budgetParam = params.get('budget_max');
    if (qParam) setQ(qParam);
    if (modelParam) setModelFilter(modelParam);
    if (countryParam) setCountry(countryParam);
    if (budgetParam) {
      const n = Number(budgetParam);
      if (Number.isFinite(n) && n > 0) setBudgetMax(n);
    }
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

  const fuels = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.fuel_type).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [vehicles]);

  const transmissions = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.transmission).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [vehicles]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const modelTerm = modelFilter.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (country !== 'all') {
        const code = sourceCountryCode(v);
        const label = sourceCountryLabel(v).toLowerCase();
        if (code !== country.toLowerCase() && label !== country.toLowerCase()) return false;
      }
      if (makeFilter !== 'all' && v.make.toLowerCase() !== makeFilter.toLowerCase()) return false;
      if (modelTerm && !(v.model || '').toLowerCase().includes(modelTerm)) return false;
      if (budgetMax != null && v.listed_price != null && Number(v.listed_price) > budgetMax) return false;
      if (fuel !== 'all' && (v.fuel_type || '').toLowerCase() !== fuel.toLowerCase()) return false;
      if (transmission !== 'all' && (v.transmission || '').toLowerCase() !== transmission.toLowerCase()) return false;
      if (!term) return true;
      return [v.make, v.model, v.stock_number, v.part_sku, v.color, v.source_country, String(v.model_year || '')]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term));
    });
  }, [vehicles, q, country, makeFilter, modelFilter, budgetMax, fuel, transmission]);

  const clearFilters = () => {
    setQ('');
    setCountry('all');
    setMakeFilter('all');
    setModelFilter('');
    setBudgetMax(null);
    setFuel('all');
    setTransmission('all');
  };

  const field =
    'h-11 w-full rounded-xl border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)] outline-none focus:ring-2 focus:ring-[var(--jct-vermilion)]/25';

  const FilterPanel = (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-muted-2)]">Make</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMakeFilter('all');
              setModelFilter('');
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium',
              makeFilter === 'all'
                ? 'border-[var(--jct-navy)] bg-[var(--jct-navy)] text-white'
                : 'border-[var(--jct-border)] bg-white text-[var(--jct-navy)]'
            )}
          >
            All
          </button>
          {makes.slice(0, 12).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMakeFilter(m);
                setModelFilter('');
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium',
                makeFilter === m
                  ? 'border-[var(--jct-navy)] bg-[var(--jct-navy)] text-white'
                  : 'border-[var(--jct-border)] bg-white text-[var(--jct-navy)]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-muted-2)]">
          Max budget (FOB)
        </label>
        <select
          value={budgetMax ?? ''}
          onChange={(e) => setBudgetMax(e.target.value ? Number(e.target.value) : null)}
          className={field}
        >
          <option value="">Any budget</option>
          <option value="5000">Up to $5,000</option>
          <option value="10000">Up to $10,000</option>
          <option value="15000">Up to $15,000</option>
          <option value="20000">Up to $20,000</option>
          <option value="30000">Up to $30,000</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-muted-2)]">
          Origin
        </label>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
          <option value="all">All origins</option>
          {countries.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {fuels.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-muted-2)]">
            Fuel
          </label>
          <select value={fuel} onChange={(e) => setFuel(e.target.value)} className={field}>
            <option value="all">Any fuel</option>
            {fuels.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {transmissions.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jct-muted-2)]">
            Transmission
          </label>
          <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={field}>
            <option value="all">Any transmission</option>
            {transmissions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--jct-vermilion)] text-sm font-semibold text-white"
        onClick={() => setFiltersOpen(false)}
      >
        Show {filtered.length} results
      </button>
      <button
        type="button"
        onClick={clearFilters}
        className="w-full text-center text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  );

  return (
    <PublicShell>
      <section className="jct-home-wrap py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <nav className="text-xs text-[var(--jct-muted-2)]">
              <Link href="/" className="hover:text-[var(--jct-navy)]">
                Home
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-[var(--jct-navy)]">{catalog.title}</span>
            </nav>
            <h1 className="mt-2 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">
              {catalog.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--jct-muted)]">
              {loading ? '…' : (
                <>
                  <span className="font-semibold text-[var(--jct-navy)]">{filtered.length}</span> vehicles
                  available — updated today
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--jct-muted-2)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search make, model, stock #…"
                className={`${field} pl-10`}
              />
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--jct-navy)] bg-[var(--jct-navy)] px-4 text-sm font-semibold text-white md:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-[var(--jct-border)] bg-white p-5 shadow-[0_4px_18px_rgba(11,31,51,0.06)]">
              <p className="mb-4 font-display text-sm font-semibold text-[var(--jct-navy)]">Filters</p>
              {FilterPanel}
            </div>
          </aside>

          <div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-[var(--jct-muted-2)]">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-10 text-center">
                <CarFront className="mx-auto h-10 w-10 text-[var(--jct-muted-2)]" />
                <p className="mt-3 font-medium text-[var(--jct-navy)]">No vehicles match these filters</p>
                <p className="mt-1 text-sm text-[var(--jct-muted)]">Try clearing filters or ask us to source for you.</p>
                <button type="button" onClick={clearFilters} className="jct-btn-primary mt-5 px-5">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} hrefBase={catalog.path} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile filter sheet */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-base font-semibold text-[var(--jct-navy)]">Filters</p>
              <button
                type="button"
                className="text-sm font-medium text-[var(--jct-muted)]"
                onClick={() => setFiltersOpen(false)}
              >
                Close
              </button>
            </div>
            {FilterPanel}
          </div>
        </div>
      ) : null}
    </PublicShell>
  );
}
