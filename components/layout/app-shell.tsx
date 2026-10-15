'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { useAuth } from '@/lib/auth-provider';
import { Loader2 } from 'lucide-react';
import { JCT_OFFICIAL } from '@/lib/jct-official';


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
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img
            src={JCT_OFFICIAL.logo}
            alt="Japan Circular Trading"
            className="h-20 w-auto max-w-[280px] object-contain bg-white"
          />
          <div className="flex items-center gap-2 text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading ERP...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="erp-shell flex min-h-[100dvh] bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
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
            className="absolute inset-0 bg-black/40"
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

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-3 sm:p-4 md:p-5 lg:p-6"
        >
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
