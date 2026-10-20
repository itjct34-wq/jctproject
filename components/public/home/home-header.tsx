'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { PUBLIC_STOCK_NAV } from '@/lib/stock-category';
import { cn } from '@/lib/utils';

const NAV = [
  ...PUBLIC_STOCK_NAV,
  { href: '/#source-markets', label: 'Source markets' },
  { href: '/blog', label: 'Insights' },
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
      <div className="jct-home-wrap flex min-h-14 items-center justify-between gap-4 py-2.5 sm:min-h-16 lg:py-3">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-[0.18em] text-[var(--jct-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]"
          aria-label="ERP home"
        >
          ERP
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
        <div
          id="home-mobile-nav"
          className="fixed inset-0 z-[60] flex flex-col bg-[var(--jct-panel,#f7f8fa)] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex items-center justify-between border-b border-[var(--jct-border)] px-4 py-3">
            <span className="font-display text-lg font-semibold tracking-[0.18em] text-[var(--jct-navy)]">ERP</span>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--jct-navy)]/20"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-3" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-2xl px-4 py-3.5 text-base font-medium text-[var(--jct-navy)] hover:bg-white',
                    navLinkActive(pathname, item.href) && 'bg-white font-semibold shadow-sm'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          <div className="sticky bottom-0 space-y-2 border-t border-[var(--jct-border)] bg-[var(--jct-panel,#f7f8fa)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/inventory"
              onClick={() => setOpen(false)}
              className="jct-btn-secondary flex w-full items-center justify-center px-4 py-3 text-center text-base"
            >
              Search stock
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="jct-btn-primary flex w-full items-center justify-center px-4 py-3 text-center text-base"
            >
              Request a car
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
