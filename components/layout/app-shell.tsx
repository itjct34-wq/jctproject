'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { useAuth } from '@/lib/auth-provider';
import { Loader2 } from 'lucide-react';


export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(pathname);
      router.push(`/login?redirect=${redirect}`);
    }
  }, [user, loading, router, pathname]);

  // Close the mobile drawer whenever the page changes (tapping a link used to leave it open).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // While the drawer is open: Escape closes it, the page behind it does not scroll,
  // and it closes itself if the screen grows to desktop width.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      mq.removeEventListener('change', onChange);
    };
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="erp-shell flex min-h-[100dvh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/50 bg-card/80 px-8 py-10 shadow-glass backdrop-blur-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-sm">
            <span className="text-xs font-bold tracking-wide">ERP</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="erp-shell flex min-h-[100dvh]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-brand-foreground"
      >
        Skip to main content
      </a>

      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchStartX == null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            // Swipe left to close drawer
            if (dx < -60) setMobileOpen(false);
            setTouchStartX(null);
          }}
        >
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <Sidebar
              mobile
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-3 sm:p-4 md:p-5 lg:p-6"
        >
          <div className="animate-glass-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
