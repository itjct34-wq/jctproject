import Link from 'next/link';
import { BrandLogo } from '@/components/public/brand-logo';
import { CountryFlag } from '@/components/public/country-flag';
import { DESTINATION_COUNTRIES } from '@/lib/public/countries';
import { PUBLIC_SOURCE_MARKETS, sourceMarketPath } from '@/lib/public/source-markets';

export function HomeFooter() {
  return (
    <footer className="jct-site-footer">
      <div className="jct-home-wrap grid gap-8 py-12 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <Link href="/" aria-label="Japan Circular Trading home" className="inline-block">
            <BrandLogo
              placement="footer"
              markClassName="brightness-0 invert"
            />
          </Link>
          <p className="max-w-md text-sm leading-relaxed text-white/75">
            Used vehicle export from Nagoya, Japan. Auction sourcing, inspection support, RORO and container shipping
            under FOB, C&amp;F and CIF.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/90">Export destinations</p>
          <ul className="flex flex-wrap gap-2">
            {DESTINATION_COUNTRIES.map((country) => (
              <li key={country.iso2}>
                <Link href="/inventory" className="jct-chip border-white/20 bg-white/10 text-white">
                  <CountryFlag country={country.name} size="sm" />
                  <span>{country.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/90">Explore</p>
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
            <li><Link href="/blog" className="jct-footer-link">Insights</Link></li>
            <li><Link href="/verify-agent" className="jct-footer-link">Verify agent</Link></li>
            <li><Link href="/about" className="jct-footer-link">About</Link></li>
            <li><Link href="/contact" className="jct-footer-link">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/90">Get in touch</p>
          <ul className="space-y-2 text-sm text-white/75">
            <li>Nagoya, Aichi 454-0943, Japan</li>
            <li>
              <Link href="/contact" className="jct-footer-link">
                Send an inquiry
              </Link>
            </li>
          </ul>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-white/90">Staff</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border-2 border-white/50 bg-transparent px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10"
            >
              ERP login
            </Link>
            <Link
              href="/download"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border-2 border-white/50 bg-transparent px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10"
            >
              Android app
            </Link>
          </div>
        </div>
      </div>
      <div className="jct-site-footer-bar py-4 text-center text-xs">
        <p>© {new Date().getFullYear()} Japan Circular Trading Co., Ltd. · Used vehicle export</p>
        <p className="mt-1">
          Brand names, logos and flags belong to their respective owners. We are not affiliated with them.
        </p>
      </div>
    </footer>
  );
}
