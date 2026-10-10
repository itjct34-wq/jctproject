import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-600">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2 space-y-3">
          <p className="text-zinc-900 font-semibold">Japan Circular Trading Co., Ltd.</p>
          <p className="text-sm leading-relaxed max-w-md">
            Used vehicle export from Nagoya, Japan. Auction sourcing, inspection support, RORO and container shipping under FOB / C&F / CIF.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/inventory" className="hover:text-zinc-900">Inventory</Link></li>
            <li><Link href="/blog" className="hover:text-zinc-900">Guides</Link></li>
            <li><Link href="/verify-agent" className="hover:text-zinc-900">Verify agent</Link></li>
            <li><Link href="/about" className="hover:text-zinc-900">About</Link></li>
            <li><Link href="/contact" className="hover:text-zinc-900">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Contact</p>
          <ul className="space-y-2 text-sm">
            <li>Nagoya, Aichi 454-0943, Japan</li>
            <li><a href="tel:+817022416356" className="hover:text-zinc-900">+81 70-2241-6356</a></li>
            <li><a href="mailto:info@japancirculartrading.com" className="hover:text-zinc-900">info@japancirculartrading.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-100 py-4 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Japan Circular Trading Co., Ltd. All rights reserved.
      </div>
    </footer>
  );
}
