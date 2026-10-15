import Link from 'next/link';
import { BrandLogo } from '@/components/public/brand-logo';
import { CountryFlag } from '@/components/public/country-flag';
import { DESTINATION_COUNTRIES } from '@/lib/public/countries';
import { PUBLIC_SOURCE_MARKETS, sourceMarketPath } from '@/lib/public/source-markets';

export function HomeFooter() {
  return (
    <footer className="border-t border-[var(--jct-border)] bg-white text-[var(--jct-muted)]">
      <div className="jct-home-wrap grid gap-8 py-12 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <BrandLogo placement="footer" />
          <p className="max-w-md text-sm leading-relaxed">
            Used vehicle export from Nagoya, Japan. Auction sourcing, inspection support, RORO and container shipping
            under FOB, C&amp;F and CIF.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--jct-muted-2)]">Export destinations</p>
          <ul className="flex flex-wrap gap-2">
            {DESTINATION_COUNTRIES.map((country) => (
              <li key={country.iso2}>
                <Link
                  href={`/inventory`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--jct-border)] bg-[var(--jct-panel)] px-2 py-1"
                >
                  <CountryFlag country={country.name} size="sm" />
                  <span className="text-xs text-[var(--jct-navy)]">{country.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--jct-muted-2)]">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/inventory" className="hover:text-[var(--jct-navy)]">Cars</Link></li>
            {PUBLIC_SOURCE_MARKETS.slice(0, 4).map((market) => (
              <li key={market.code}>
                <Link href={sourceMarketPath(market)} className="hover:text-[var(--jct-navy)]">
                  Stock from {market.name}
                </Link>
              </li>
            ))}
            <li><Link href="/machinery" className="hover:text-[var(--jct-navy)]">Machinery</Link></li>
            <li><Link href="/parts" className="hover:text-[var(--jct-navy)]">Parts</Link></li>
            <li><Link href="/blog" className="hover:text-[var(--jct-navy)]">Guides</Link></li>
            <li><Link href="/verify-agent" className="hover:text-[var(--jct-navy)]">Verify agent</Link></li>
            <li><Link href="/about" className="hover:text-[var(--jct-navy)]">About</Link></li>
            <li><Link href="/contact" className="hover:text-[var(--jct-navy)]">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--jct-muted-2)]">Contact</p>
          <ul className="space-y-2 text-sm">
            <li>Nagoya, Aichi 454-0943, Japan</li>
            <li><a href="tel:+817022416356" className="hover:text-[var(--jct-navy)]">+81 70-2241-6356</a></li>
            <li>
              <a href="mailto:info@japancirculartrading.com" className="hover:text-[var(--jct-navy)]">
                info@japancirculartrading.com
              </a>
            </li>
          </ul>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-[var(--jct-muted-2)]">Staff</p>
          <Link href="/login" className="text-sm hover:text-[var(--jct-navy)]">
            ERP login
          </Link>
        </div>
      </div>
      <div className="border-t border-[var(--jct-border)] py-4 text-center text-xs text-[var(--jct-muted-2)]">
        <p>© {new Date().getFullYear()} Japan Circular Trading Co., Ltd.</p>
        <p className="mt-1">
          Brand names, logos and flags belong to their respective owners. JCT is not affiliated with them.
        </p>
      </div>
    </footer>
  );
}
