'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/inventory', label: 'Cars' },
  { href: '/blog', label: 'Import guides' },
  { href: '/verify-agent', label: 'Verify agent' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function HomeHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--jct-border)] bg-white/95 backdrop-blur-md">
      <div className="jct-home-wrap flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <Link href="/" className="flex min-h-11 items-center gap-3">
          <img
            src="/images/jct-official-logo.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 rounded-lg object-contain"
          />
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold text-[var(--jct-navy)] sm:text-base">
              Japan Circular Trading
            </span>
            <span className="block text-[11px] text-[var(--jct-muted-2)]">Used vehicle export · Nagoya</span>
          </span>
          <span className="sr-only">Japan Circular Trading home</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-[var(--jct-muted)] transition-colors hover:bg-[var(--jct-panel)] hover:text-[var(--jct-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-vermilion)]',
                pathname === item.href || pathname.startsWith(item.href)
                  ? 'bg-[var(--jct-panel)] font-medium text-[var(--jct-navy)]'
                  : ''
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/contact"
            className="ml-2 inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-4 text-sm font-semibold text-white hover:bg-[#c23024] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-navy)]"
          >
            Request a car
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--jct-navy)] hover:bg-[var(--jct-panel)] lg:hidden"
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
