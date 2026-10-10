import { PublicShell } from '@/components/public/public-shell';

export const metadata = {
  title: 'About — Japan Circular Trading',
  description: 'Used vehicle export specialists based in Nagoya, Japan.',
};

export default function AboutPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">About us</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold text-white">Japan Circular Trading</h1>
        <p className="mt-6 text-zinc-400 leading-relaxed">
          We are a Nagoya-based exporter focused on quality used vehicles for international markets.
          Our team combines auction-floor experience with disciplined documentation and shipping coordination.
        </p>
        <p className="mt-4 text-zinc-400 leading-relaxed">
          Whether you need a single unit or a regular monthly allocation, we structure deals under
          FOB, C&amp;F, or CIF and support RORO or container loading from major Japanese ports.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Headquarters</p>
            <p className="mt-2 text-sm text-white leading-relaxed">
              2-505-101 Daitoro, Nakagawa-ku<br />
              Nagoya, Aichi 454-0943, Japan
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Contact</p>
            <p className="mt-2 text-sm text-white leading-relaxed">
              +81 70-2241-6356<br />
              info@japancirculartrading.com
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
