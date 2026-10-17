import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { CountryList } from '@/components/public/home/country-list';
import { CtaBand } from '@/components/public/home/cta-band';
import { HeroSearch } from '@/components/public/home/hero-search';
import { SourceMarketsSection } from '@/components/public/home/source-markets-section';
import { HomeShell } from '@/components/public/home/home-shell';
import { MakeList } from '@/components/public/home/make-list';
import { StepsSection } from '@/components/public/home/steps-section';
import { TrustStrip } from '@/components/public/home/trust-strip';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { loadHomeData } from '@/lib/public/home-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Used cars from Japan | Nagoya export',
  description:
    'Buy used cars direct from Japan. FOB, C&F and CIF quotes, RORO or container shipping from Nagoya, with payment to official company accounts only.',
  openGraph: {
    title: 'Used cars from Japan | Nagoya export',
    description:
      'Auction-grade Toyota, Honda, Nissan and more. Export from Nagoya with FOB, C&F or CIF quotes.',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vehicle Export',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Nagoya',
    addressRegion: 'Aichi',
    postalCode: '454-0943',
    addressCountry: 'JP',
  },
};

export default async function HomePage() {
  const { arrivals, makes, modelsByMake } = await loadHomeData();
  const makeNames = makes.map((make) => make.name);

  return (
    <HomeShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 4.1 Hero — full-bleed navy band + overlapping search */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero/export-lot-01.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--jct-navy)] via-[var(--jct-navy)]/92 to-[var(--jct-navy)]/55" />
        </div>

        <div className="jct-home-wrap relative z-10 pb-28 pt-14 md:pb-36 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Japanese used cars · Export from Nagoya
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl md:text-[3.5rem]">
            Japanese cars, shipped to your{' '}
            <span className="text-[var(--jct-vermilion)]">port</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80">
            Auction-grade Toyota, Honda, Nissan and more. FOB, C&amp;F or CIF quotes, RORO or container
            shipping, and payment to official company accounts only.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
          </div>
        </div>

        <div className="jct-home-wrap relative z-20 -mt-16 pb-2 md:-mt-20">
          <HeroSearch makes={makeNames} modelsByMake={modelsByMake} />
        </div>
      </section>

      <TrustStrip />

      {arrivals.length > 0 && (
        <section className="jct-home-wrap py-12 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">
                Featured stock
              </h2>
              <p className="mt-1 text-sm text-[var(--jct-muted-2)]">FOB prices in Japan, photos on every listing</p>
            </div>
            <Link
              href="/inventory"
              className="text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
            >
              See all stock
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {arrivals.slice(0, 3).map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      )}

      <MakeList makes={makes} />
      <StepsSection />
      <SourceMarketsSection />
      <CountryList />
      <CtaBand />
    </HomeShell>
  );
}
