import type { Metadata } from 'next';
import Link from 'next/link';
import { CountryList } from '@/components/public/home/country-list';
import { CtaBand } from '@/components/public/home/cta-band';
import { HeroSearch } from '@/components/public/home/hero-search';
import { HomeShell } from '@/components/public/home/home-shell';
import { MakeList } from '@/components/public/home/make-list';
import { StepsSection } from '@/components/public/home/steps-section';
import { TrustStrip } from '@/components/public/home/trust-strip';
import { VehicleCard } from '@/components/public/home/vehicle-card';
import { loadHomeData } from '@/lib/public/home-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Used cars from Japan | Japan Circular Trading, Nagoya',
  description:
    'Buy used cars direct from Japan. FOB, C&F and CIF quotes, RORO or container shipping from Nagoya, with payment to official company accounts only.',
  openGraph: {
    title: 'Used cars from Japan | Japan Circular Trading, Nagoya',
    description:
      'Auction-grade Toyota, Honda, Nissan and more. Export from Nagoya with FOB, C&F or CIF quotes.',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Japan Circular Trading Co., Ltd.',
  url: 'https://japancirculartrading.com',
  email: 'info@japancirculartrading.com',
  telephone: '+81-70-2241-6356',
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
      <section className="jct-home-wrap grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">
            Japanese used cars · Export from Nagoya
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.12] text-[var(--jct-navy)] sm:text-5xl">
            Buy direct from Japan.
            <br />
            Delivered to your port.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--jct-muted)]">
            Auction-grade Toyota, Honda, Nissan and more. FOB, C&amp;F or CIF quotes, RORO or container shipping, and
            payment to official company accounts only.
          </p>
          <div className="mt-8">
            <HeroSearch makes={makeNames} modelsByMake={modelsByMake} />
          </div>
        </div>
        <div className="relative">
          <div
            className="aspect-[4/3] overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0B1F33] via-[#16324d] to-[#0B1F33]"
            role="img"
            aria-label="Japanese export yard — photo coming soon"
          />
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white p-4 shadow-[0_12px_40px_rgba(11,31,51,0.18)] sm:left-auto sm:right-6 sm:w-64">
            <p className="text-[11px] uppercase tracking-wider text-[var(--jct-muted-2)]">RORO and container</p>
            <p className="mt-1 font-display text-sm font-semibold text-[var(--jct-navy)]">Price terms you can choose</p>
            <p className="mt-2 text-sm text-[var(--jct-muted)]">FOB / C&amp;F / CIF</p>
          </div>
        </div>
      </section>

      <TrustStrip />
      <MakeList makes={makes} />

      {arrivals.length > 0 && (
        <section className="jct-home-wrap pb-12 md:pb-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">New arrivals</h2>
              <p className="mt-1 text-sm text-[var(--jct-muted-2)]">FOB prices in Japan, photos on every listing</p>
            </div>
            <Link href="/inventory" className="text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline">
              See all stock
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {arrivals.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      )}

      <StepsSection />
      <CountryList />
      <CtaBand />
    </HomeShell>
  );
}
