import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SourceMarketPage } from '@/components/public/source-market-page';
import { PUBLIC_SOURCE_MARKETS, resolvePublicSourceMarket } from '@/lib/public/source-markets';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PUBLIC_SOURCE_MARKETS.map((market) => ({ slug: market.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const market = resolvePublicSourceMarket(slug);
  if (!market) return { title: 'Source market | Japan export' };
  return {
    title: `Used cars from ${market.name} | Japan export`,
    description: `${market.tagline}. Browse export stock sourced from ${market.name}.`,
  };
}

export default async function SourceCountryPage({ params }: Props) {
  const { slug } = await params;
  const market = resolvePublicSourceMarket(slug);
  if (!market) notFound();
  return <SourceMarketPage market={market} />;
}
