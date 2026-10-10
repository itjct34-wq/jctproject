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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/images/705607377_122127683871150897_4165866362055650133_n-removebg-preview.png"
            alt="Japan Circular Trading"
            className="h-9 w-9 object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide text-white">Japan Circular Trading</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-red-400">Export · Japan</p>
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
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="ml-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
          >
            ERP Login
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden rounded-md p-2 text-zinc-300 hover:bg-white/10"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-zinc-950 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm',
                  pathname === item.href ? 'bg-white/10 text-white' : 'text-zinc-300'
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-red-600 px-4 py-2.5 text-center text-sm font-medium text-white"
            >
              ERP Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
