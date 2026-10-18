import Link from 'next/link';
import { BrandLogo } from '@/components/public/brand-logo';
import { CountryFlag } from '@/components/public/country-flag';
import { DESTINATION_COUNTRIES } from '@/lib/public/countries';
import { PUBLIC_SOURCE_MARKETS, sourceMarketPath } from '@/lib/public/source-markets';

export function HomeFooter() {
  return (
    <footer className="jct-site-footer text-[var(--jct-muted)]">
      <div className="jct-home-wrap grid gap-8 py-12 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <BrandLogo placement="footer" />
          <p className="max-w-md text-sm leading-relaxed text-[var(--jct-muted)]">
            Used vehicle export from Nagoya, Japan. Auction sourcing, inspection support, RORO and container shipping
            under FOB, C&amp;F and CIF.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--jct-navy)]">Export destinations</p>
          <ul className="flex flex-wrap gap-2">
            {DESTINATION_COUNTRIES.map((country) => (
              <li key={country.iso2}>
                <Link href={`/inventory`} className="jct-chip">
                  <CountryFlag country={country.name} size="sm" />
                  <span>{country.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--jct-navy)]">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/inventory" className="jct-footer-link">Cars</Link></li>
            {PUBLIC_SOURCE_MARKETS.slice(0, 4).map((market) => (
              <li key={market.code}>
                <Link href={sourceMarketPath(market)} className="jct-footer-link">
                  Stock from {market.name}
                </Link>
              </li>
            ))}
            <li><Link href="/machinery" className="jct-footer-link">Machinery</Link></li>
            <li><Link href="/parts" className="jct-footer-link">Parts</Link></li>
            <li><Link href="/blog" className="jct-footer-link">Guides</Link></li>
            <li><Link href="/verify-agent" className="jct-footer-link">Verify agent</Link></li>
            <li><Link href="/about" className="jct-footer-link">About</Link></li>
            <li><Link href="/contact" className="jct-footer-link">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--jct-navy)]">Get in touch</p>
          <ul className="space-y-2 text-sm">
            <li>Nagoya, Aichi 454-0943, Japan</li>
            <li>
              <Link href="/contact" className="jct-footer-link">
                Send an inquiry
              </Link>
            </li>
          </ul>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-[var(--jct-navy)]">Staff</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="jct-btn-secondary px-4 py-2 text-sm">
              ERP login
            </Link>
            <Link href="/download" className="jct-btn-secondary px-4 py-2 text-sm">
              Android app
            </Link>
          </div>
        </div>
      </div>
      <div className="jct-site-footer-bar py-4 text-center text-xs text-[var(--jct-muted-2)]">
        <p>© {new Date().getFullYear()} · Used vehicle export</p>
        <p className="mt-1">
          Brand names, logos and flags belong to their respective owners. We are not affiliated with them.
        </p>
      </div>
    </footer>
  );
}
