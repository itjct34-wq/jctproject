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
    <header className="sticky top-0 z-50 border-b border-[var(--jct-border)] bg-white">
      <div className="jct-home-wrap flex min-h-[72px] items-center justify-between gap-4 py-2.5 sm:min-h-[88px] md:min-h-[104px] lg:min-h-[112px] lg:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
          aria-label="Japan Circular Trading home"
        >
          <BrandLogo placement="header" />
        </Link>
        <nav className="hidden shrink-0 items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-[var(--jct-muted)] transition-colors hover:bg-[var(--jct-panel)] hover:text-[var(--jct-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]',
                navLinkActive(pathname, item.href)
                  ? 'bg-[var(--jct-panel)] font-medium text-[var(--jct-navy)]'
                  : ''
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/contact"
            className="ml-2 inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-4 text-sm font-semibold text-white hover:bg-[#c23024]"
          >
            Request a car
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--jct-navy)] hover:bg-[var(--jct-panel)] lg:hidden"
          aria-expanded={open}
          aria-controls="home-mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id="home-mobile-nav" className="border-t border-[var(--jct-border)] bg-white px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base text-[var(--jct-navy)] hover:bg-[var(--jct-panel)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg bg-[var(--jct-vermilion)] px-4 py-3 text-center text-base font-semibold text-white"
            >
              Request a car
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
