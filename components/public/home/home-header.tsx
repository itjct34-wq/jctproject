'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BrandLogo } from '@/components/public/brand-logo';
import { PUBLIC_STOCK_NAV } from '@/lib/stock-category';
import { cn } from '@/lib/utils';

const NAV = [
  ...PUBLIC_STOCK_NAV,
  { href: '/#source-markets', label: 'Source markets' },
  { href: '/blog', label: 'Import guides' },
  { href: '/verify-agent', label: 'Verify agent' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function navLinkActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HomeHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="jct-site-header sticky top-0 z-50">
      <div className="jct-home-wrap flex min-h-[72px] items-center justify-between gap-4 py-2.5 sm:min-h-[88px] md:min-h-[104px] lg:min-h-[112px] lg:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center rounded-lg bg-white/70 px-2 py-1 shadow-[0_2px_12px_rgba(11,31,51,0.06)] ring-1 ring-[var(--jct-navy)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
          aria-label="Home"
        >
          <BrandLogo placement="header" label="Export" />
        </Link>
        <nav className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'jct-nav-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]',
                navLinkActive(pathname, item.href) && 'is-active'
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/inventory"
            className="jct-btn-secondary ml-2 px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
          >
            Search stock
          </Link>
          <Link
            href="/contact"
            className="jct-btn-primary ml-2 px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-navy)]"
          >
            Request a car
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--jct-navy)]/20 bg-white/90 text-[var(--jct-navy)] hover:border-[var(--jct-vermilion)] hover:text-[var(--jct-vermilion)] lg:hidden"
          aria-expanded={open}
          aria-controls="home-mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id="home-mobile-nav" className="jct-site-header-mobile px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-full px-4 py-3 text-base text-[var(--jct-navy)] hover:bg-white hover:shadow-[inset_0_-2px_0_var(--jct-vermilion)]',
                  navLinkActive(pathname, item.href) && 'bg-white font-semibold shadow-[inset_0_-2px_0_var(--jct-vermilion)]'
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/inventory"
              onClick={() => setOpen(false)}
              className="jct-btn-secondary mt-2 w-full px-4 py-3 text-center text-base"
            >
              Search stock
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="jct-btn-primary mt-2 w-full px-4 py-3 text-center text-base"
            >
              Request a car
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
