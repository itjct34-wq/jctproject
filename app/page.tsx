import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { CountryList } from '@/components/public/home/country-list';
import { CtaBand } from '@/components/public/home/cta-band';
import { HeroSearch } from '@/components/public/home/hero-search';
import { SourceMarketsSection } from '@/components/public/home/source-markets-section';
import { HomeShell } from '@/components/public/home/home-shell';
import { JustListedRail } from '@/components/public/home/just-listed-rail';
import { MakeList } from '@/components/public/home/make-list';
import { StepsSection } from '@/components/public/home/steps-section';
import { TrustStrip } from '@/components/public/home/trust-strip';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { loadHomeData } from '@/lib/public/home-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Japan Circular Trading | Used cars from Japan',
  description:
    'Japan Circular Trading (JCT) — buy used cars direct from Japan. FOB, C&F and CIF quotes, RORO or container shipping from Nagoya.',
  openGraph: {
    title: 'Japan Circular Trading | Used cars from Japan',
    description:
      'Auction-grade Toyota, Honda, Nissan and more. Export from Nagoya with FOB, C&F or CIF quotes.',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Japan Circular Trading',
  alternateName: 'JCT',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Nagoya',
    addressRegion: 'Aichi',
    postalCode: '454-0943',
    addressCountry: 'JP',
  },
};

export default async function HomePage() {
  const { arrivals, justListed, stockCount, makes, modelsByMake } = await loadHomeData();
  const makeNames = makes.map((make) => make.name);
  const stockLabel =
    stockCount > 0 ? `${stockCount.toLocaleString()}+ units in stock` : 'Live export stock';

  return (
    <HomeShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Brand-first full-bleed hero — one composition, no cards in the hero plane */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero/export-lot-01.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover jct-hero-kenburns"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--jct-navy)] via-[var(--jct-navy)]/90 to-[var(--jct-navy)]/50" />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 18% 22%, rgba(196,163,90,0.55), transparent 42%), radial-gradient(circle at 88% 70%, rgba(216,57,43,0.35), transparent 40%)',
            }}
            aria-hidden
          />
        </div>

        <div className="jct-home-wrap relative z-10 pb-28 pt-14 md:pb-36 md:pt-20">
          <p className="jct-hero-enter text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--jct-gold,#C4A35A)] sm:text-xs">
            Japan Circular Trading · JCT
          </p>
          <h1 className="jct-hero-enter jct-hero-enter-delay-1 mt-3 max-w-3xl font-display text-[2.35rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-[3.35rem]">
            Japan Circular Trading
          </h1>
          <p className="jct-hero-enter jct-hero-enter-delay-2 mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Auction-grade Japanese cars, ready for your port — FOB, C&amp;F or CIF from Nagoya.
          </p>
          <div className="jct-hero-enter jct-hero-enter-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/inventory"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--jct-vermilion)] px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse stock
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get a price estimate
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-white/55 sm:inline">
              {stockLabel}
            </span>
          </div>
        </div>

        <div className="jct-home-wrap relative z-20 -mt-16 pb-2 md:-mt-20">
          <HeroSearch makes={makeNames} modelsByMake={modelsByMake} />
        </div>
      </section>

      <TrustStrip />

      {arrivals.length > 0 && (
        <section className="jct-home-wrap py-12 md:py-16" aria-labelledby="featured-stock-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2
                id="featured-stock-heading"
                className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl"
              >
                Featured stock
              </h2>
              <p className="mt-1 text-sm text-[var(--jct-muted-2)]">
                Real units with photos, source country, and FOB pricing — pick a car and request a quote.
              </p>
            </div>
            <Link
              href="/inventory"
              className="shrink-0 text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              See all stock
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {arrivals.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      )}

      <JustListedRail vehicles={justListed.length ? justListed : arrivals} />

      <MakeList makes={makes} />
      <StepsSection />
      <SourceMarketsSection />
      <CountryList />
      <CtaBand />
    </HomeShell>
  );
}
