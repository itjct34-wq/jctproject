'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { CountryFlag } from '@/components/public/country-flag';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { supabase } from '@/lib/supabase/client';
import {
  attachGallery,
  selectListedVehicles,
  sourceCountryCode,
  type PublicVehicle,
  type VehicleImageRow,
} from '@/lib/public/vehicles';
import type { PublicSourceMarket } from '@/lib/public/source-markets';
import { inventoryQueryForSource } from '@/lib/public/source-markets';
import { CarFront, Loader2 } from 'lucide-react';

export function SourceMarketPage({ market }: { market: PublicSourceMarket }) {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await selectListedVehicles(supabase, { limit: 96, category: 'car' });
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as unknown as Omit<PublicVehicle, 'gallery'>[];
      const ids = rows.map((row) => row.id);
      let images: VehicleImageRow[] = [];
      if (ids.length) {
        const withRole = await supabase
          .from('vehicle_images')
          .select('vehicle_id, image_url, sort_order, is_primary, image_role')
          .in('vehicle_id', ids)
          .not('image_role', 'in', '(auction_sheet,yard)');
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
  }, []);

  const filtered = useMemo(
    () => vehicles.filter((v) => sourceCountryCode(v) === market.code.toLowerCase()),
    [vehicles, market.code]
  );

  return (
    <PublicShell>
      <section className="jct-home-wrap py-10 md:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <CountryFlag country={market.name} code={market.code} size="lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">Source market</p>
            <h1 className="font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">{market.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--jct-muted)]">{market.tagline}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={inventoryQueryForSource(market.code)} className="jct-btn-secondary px-4">
            View in full inventory
          </Link>
          <Link href="/contact" className="jct-btn-primary px-4">
            Request sourcing
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[var(--jct-muted-2)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-10 text-center">
            <CarFront className="mx-auto h-10 w-10 text-[var(--jct-muted-2)]" />
            <p className="mt-3 font-display text-lg font-semibold text-[var(--jct-navy)]">Stock uploading soon</p>
            <p className="mt-2 text-sm text-[var(--jct-muted)]">
              We are preparing {market.name} listings. Tell us what you need and our team will source it for you.
            </p>
            <Link href="/contact" className="jct-btn-primary mt-5 px-5">
              Contact sales
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
