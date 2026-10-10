'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currencies';
import { ArrowRight, BadgeCheck, CarFront, Gavel, Globe2, Loader2, ShieldCheck, Ship } from 'lucide-react';

type Stock = {
  id: string;
  stock_number: string;
  make: string;
  model: string;
  model_year: number | null;
  mileage_km: number | null;
  listed_price: number | null;
  listed_currency: string;
  primary_image_url: string | null;
  transmission: string | null;
  fuel_type: string | null;
};

type BlogTeaser = {
  slug: string;
  title: string;
  category: string | null;
  published_at: string | null;
};

const MAKES = ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Suzuki', 'Mitsubishi', 'Subaru', 'Daihatsu', 'Lexus'];

export default function HomePage() {
  const [stock, setStock] = useState<Stock[]>([]);
  const [posts, setPosts] = useState<BlogTeaser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [vRes, bRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select(
            'id, stock_number, make, model, model_year, mileage_km, listed_price, listed_currency, primary_image_url, transmission, fuel_type'
          )
          .eq('status', 'in_stock')
          .order('updated_at', { ascending: false })
          .limit(12),
        supabase
          .from('blog_posts')
          .select('slug, title, category, published_at')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(3),
      ]);
      setStock((vRes.data || []) as Stock[]);
      setPosts((bRes.data || []) as BlogTeaser[]);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicShell>
      {/* Hero — Afridi-inspired */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950/50" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-600/30 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-400">Japanese used cars · Export from Nagoya</p>
          <h1 className="mt-4 max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.08]">
            Used cars Japan — buy direct, delivered to{' '}
            <em className="not-italic text-red-400">your port</em>.
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-400 leading-relaxed">
            Browse auction-grade Toyota, Honda, Nissan and more. FOB / C&F / CIF quotes, RORO or container, official company payment only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/inventory" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500">
              Search all cars <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white hover:bg-white/5">
              Ask sales to find a car
            </Link>
            <Link href="/verify-agent" className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 px-6 py-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10">
              <BadgeCheck className="h-4 w-4" /> Verify agent
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span>Licensed Japan exporter</span>
            <span>·</span>
            <span>RORO & container</span>
            <span>·</span>
            <span>Pay only to company accounts</span>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-white/5 bg-zinc-900/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { v: 'Nagoya', l: 'Export hub' },
            { v: 'FOB · C&F · CIF', l: 'Incoterms' },
            { v: 'RORO · 20/40ft', l: 'Shipping' },
            { v: 'Worldwide', l: 'Delivery' },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-sm font-semibold text-white">{s.v}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular makes */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">Browse by make</h2>
            <p className="text-sm text-zinc-500">Our most ordered brands</p>
          </div>
          <Link href="/inventory" className="text-sm text-red-400 hover:text-red-300">All cars →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {MAKES.map((m) => (
            <Link
              key={m}
              href={`/inventory?make=${encodeURIComponent(m)}`}
              className="rounded-full border border-white/10 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-200 hover:border-red-500/50 hover:text-white transition-colors"
            >
              {m}
            </Link>
          ))}
        </div>
      </section>

      {/* Live stock grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Browse our stock</h2>
            <p className="text-sm text-zinc-500 mt-1">FOB prices in Japan · photos on every listing</p>
          </div>
          <Link href="/inventory" className="text-sm text-red-400 hover:text-red-300">See all →</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-zinc-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading stock…
          </div>
        ) : stock.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-10 text-center text-zinc-500">
            Stock is updating — contact sales for current auction offers.
            <div className="mt-4">
              <Link href="/contact" className="text-red-400 text-sm">Request sourcing →</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stock.map((v) => (
              <Link
                key={v.id}
                href={`/inventory/${v.id}`}
                className="group rounded-2xl border border-white/10 bg-zinc-900/50 overflow-hidden hover:border-red-500/40 transition-all"
              >
                <div className="aspect-[16/10] bg-zinc-950 overflow-hidden">
                  {v.primary_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.primary_image_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <CarFront className="h-10 w-10 text-zinc-700" />
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="font-semibold text-white text-sm leading-snug">
                    {v.model_year ? `${v.model_year} ` : ''}{v.make} {v.model}
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {[v.mileage_km != null ? `${v.mileage_km.toLocaleString()} km` : null, v.transmission, v.fuel_type]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {v.listed_price != null
                      ? `FOB ${formatCurrency(v.listed_price, v.listed_currency)}`
                      : 'Ask for quote'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How to buy */}
      <section className="border-y border-white/5 bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold text-white">Buying from Japan, step by step</h2>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">We handle auction, export papers and shipping. You collect at your port.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Gavel, t: '1. Source', d: 'Stock or auction bid with clear grade targets.' },
              { icon: ShieldCheck, t: '2. Quote', d: 'FOB / C&F / CIF quotation and agent verification.' },
              { icon: Ship, t: '3. Ship', d: 'Export docs, RORO or container, marine cover.' },
              { icon: Globe2, t: '4. Collect', d: 'Vessel ETA and delivery to your chosen port.' },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                <s.icon className="h-5 w-5 text-red-500 mb-3" />
                <h3 className="font-semibold text-white">{s.t}</h3>
                <p className="mt-1.5 text-sm text-zinc-400">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="rounded-full border border-white/10 px-3 py-1">Pay only company accounts</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Verify agents online</span>
            <span className="rounded-full border border-white/10 px-3 py-1">JCT Nagoya</span>
          </div>
        </div>
      </section>

      {/* Blog */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Import guides</h2>
              <p className="text-sm text-zinc-500">From the blog</p>
            </div>
            <Link href="/blog" className="text-sm text-red-400 hover:text-red-300">View all →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-2xl border border-white/10 p-5 hover:border-red-500/40 transition-colors">
                <p className="text-[10px] uppercase tracking-wider text-red-400">{p.category || 'Guide'}</p>
                <h3 className="mt-1 font-semibold text-white line-clamp-2">{p.title}</h3>
                {p.published_at && (
                  <p className="mt-2 text-xs text-zinc-500">{new Date(p.published_at).toLocaleDateString()}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-gradient-to-r from-red-700 to-red-900 p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Can't find the car you want?</h2>
          <p className="mt-3 text-red-100/90 text-sm max-w-lg mx-auto">
            Tell us model, year and budget. Our team searches Japanese auctions for you.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-zinc-100">
              Request a car
            </Link>
            <Link href="/verify-agent" className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10">
              Verify an agent first
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
