import { Globe2, MapPin, ShieldCheck, Ship } from 'lucide-react';

const ITEMS = [
  { icon: MapPin, title: 'Nagoya export hub', body: 'Auction sourcing and inspection support' },
  { icon: Ship, title: 'RORO and 20/40ft container', body: 'Marine cover and export documents' },
  { icon: Globe2, title: 'Worldwide delivery', body: 'Vessel ETA to your chosen port' },
  { icon: ShieldCheck, title: 'Verified company accounts only', body: 'Check any agent online before you pay' },
];

export function TrustStrip() {
  return (
    <section className="border-y border-[var(--jct-border)] bg-white">
      <div className="jct-home-wrap grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex gap-3">
            <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--jct-canopy)]" aria-hidden="true" />
            <div>
              <h2 className="font-display text-sm font-semibold text-[var(--jct-navy)]">{item.title}</h2>
              <p className="mt-1 text-sm text-[var(--jct-muted-2)]">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
