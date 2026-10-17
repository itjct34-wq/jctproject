import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';

export const metadata = {
  title: 'About — Used vehicle export',
  description: 'Used vehicle export specialists based in Nagoya, Japan.',
};

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="jct-home-wrap max-w-3xl py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">About us</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">Nagoya vehicle export</h1>
        <p className="mt-6 leading-relaxed text-[var(--jct-muted)]">
          We are a Nagoya-based exporter focused on quality used vehicles for international markets.
          Our team combines auction-floor experience with disciplined documentation and shipping coordination.
        </p>
        <p className="mt-4 leading-relaxed text-[var(--jct-muted)]">
          Whether you need a single unit or a regular monthly allocation, we structure deals under
          FOB, C&amp;F, or CIF and support RORO or container loading from major Japanese ports.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-5">
            <p className="text-xs uppercase tracking-wider text-[var(--jct-muted-2)]">Headquarters</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--jct-navy)]">
              2-505-101 Daitoro, Nakagawa-ku<br />
              Nagoya, Aichi 454-0943, Japan
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-5">
            <p className="text-xs uppercase tracking-wider text-[var(--jct-muted-2)]">Contact</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--jct-navy)]">
              Use the inquiry form for sourcing requests and quotes.
            </p>
            <Link
              href="/contact"
              className="mt-3 inline-block text-sm font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
