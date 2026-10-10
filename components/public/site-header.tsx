'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/inventory', label: 'Cars' },
  { href: '/blog', label: 'Guides' },
  { href: '/verify-agent', label: 'Verify agent' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/images/705607377_122127683871150897_4165866362055650133_n-removebg-preview.png"
            alt="Japan Circular Trading"
            className="h-9 w-9 object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide text-zinc-900">Japan Circular Trading</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-red-600">Export · Japan</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                  ? 'bg-zinc-100 text-zinc-900 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/login" className="ml-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
            ERP Login
          </Link>
        </nav>
        <button type="button" className="md:hidden rounded-md p-2.5 text-zinc-700 hover:bg-zinc-100" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-zinc-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn('rounded-md px-3 py-3 text-base', pathname === item.href ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700')}>
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-red-600 px-4 py-3 text-center text-base font-medium text-white">
              ERP Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
