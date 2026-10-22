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
  title: 'Used cars from Japan',
  description:
    'Buy used cars direct from Japan. FOB, C&F and CIF quotes, RORO or container shipping from Nagoya.',
  openGraph: {
    title: 'Used cars from Japan',
    description:
      'Auction-grade Toyota, Honda, Nissan and more. Export from Nagoya with FOB, C&F or CIF quotes.',
    type: 'website',
  },
};

export default async function HomePage() {
  const { arrivals, justListed, featuredParts, stockCount, makes, modelsByMake } = await loadHomeData();
  const makeNames = makes.map((make) => make.name);
  const stockLabel =
    stockCount > 0 ? `${stockCount.toLocaleString()}+ units in stock` : 'Live export stock';

  return (
    <HomeShell>
      {/* Full-bleed lot hero — brand first, inventory search is the action */}
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
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--jct-navy)] via-[var(--jct-navy)]/88 to-[var(--jct-navy)]/45" />
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--jct-navy)]/80 to-transparent"
            aria-hidden
          />
        </div>

        <div className="jct-home-wrap relative z-10 pb-28 pt-12 md:pb-36 md:pt-16">
          <h1 className="jct-hero-enter jct-hero-enter-delay-1 max-w-4xl font-display text-[2.35rem] font-bold leading-[1.02] text-white sm:text-5xl md:text-[3.35rem]">
            Japan Circular Trading
          </h1>
          <p className="jct-hero-enter jct-hero-enter-delay-2 mt-3 max-w-2xl font-display text-xl font-semibold leading-snug text-white/95 sm:text-2xl md:text-[1.75rem]">
            Used cars from Japan
          </p>
          <p className="jct-hero-enter jct-hero-enter-delay-3 mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Auction-sourced stock with FOB pricing — RORO or container from Nagoya to your port.
          </p>
          <div className="jct-hero-enter jct-hero-enter-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/inventory"
              className="jct-btn-primary px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse stock
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border-2 border-white/55 bg-transparent px-6 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get a price estimate
            </Link>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-white/60 sm:inline">
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

      {featuredParts.length > 0 && (
        <section className="jct-home-wrap py-12 md:py-16" aria-labelledby="featured-parts-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2
                id="featured-parts-heading"
                className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl"
              >
                Featured parts
              </h2>
              <p className="mt-1 text-sm text-[var(--jct-muted-2)]">
                In-stock spare parts with photos — browse by make and model, then request a quote.
              </p>
            </div>
            <Link
              href="/parts"
              className="shrink-0 text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
            >
              See all parts
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredParts.map((part) => (
              <VehicleCard key={part.id} vehicle={part} hrefBase="/parts" />
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
