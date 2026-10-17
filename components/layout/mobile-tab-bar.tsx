'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CarFront,
  ListChecks,
  MoreHorizontal,
  Plus,
  MessageSquarePlus,
  CalendarClock,
  Wallet,
  FileUp,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type MobileTabBarProps = {
  onMore: () => void;
};

const TABS = [
  { id: 'home', label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', href: '/vehicles', icon: CarFront },
  { id: 'fab', label: 'New', href: null, icon: Plus },
  { id: 'tasks', label: 'Tasks', href: '/tasks', icon: ListChecks },
  { id: 'more', label: 'More', href: null, icon: MoreHorizontal },
] as const;

export function MobileTabBar({ onMore }: MobileTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, canView } = usePermissions();
  const [fabOpen, setFabOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY + 8 && y > 80) setHidden(true);
      else if (y < lastY - 8) setHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const actions = [
    can('customers', 'create')
      ? { label: 'New inquiry', href: '/inquiries', icon: MessageSquarePlus }
      : null,
    can('vehicles', 'edit')
      ? { label: 'Reserve vehicle', href: '/vehicles', icon: CalendarClock }
      : null,
    can('expenses', 'create')
      ? { label: 'Add expense', href: '/expenses', icon: Wallet }
      : null,
    can('vehicles', 'import')
      ? { label: 'Upload stock', href: '/bulk-upload', icon: FileUp }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    icon: typeof Plus;
  }>;

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-card/90 backdrop-blur-xl transition-transform duration-200 lg:hidden',
          'pb-[env(safe-area-inset-bottom)]',
          hidden && 'translate-y-full'
        )}
      >
        <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around px-1">
          {TABS.map((tab) => {
            const active =
              tab.href != null &&
              (pathname === tab.href ||
                (tab.href !== '/dashboard' && pathname.startsWith(tab.href)));
            if (tab.id === 'fab') {
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label="Quick actions"
                  onClick={() => setFabOpen(true)}
                  className="-mt-3 flex flex-col items-center justify-end gap-0.5 pb-1"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95">
                    <Plus className="h-6 w-6" strokeWidth={2} />
                  </span>
                </button>
              );
            }
            if (tab.id === 'more') {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={onMore}
                  className="flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 text-muted-foreground"
                >
                  <span className="flex h-8 w-12 items-center justify-center rounded-full">
                    <tab.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              );
            }
            if (!tab.href) return null;
            if (tab.id === 'tasks' && !canView('tasks')) return null;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  'flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 transition-colors duration-150',
                  active ? 'text-brand' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={cn(
                    'relative flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-150',
                    active && 'bg-brand/12'
                  )}
                >
                  <tab.icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                    fill={active ? 'currentColor' : 'none'}
                  />
                  {active ? (
                    <span className="absolute -bottom-0.5 h-0.5 w-0.5 rounded-full bg-brand" />
                  ) : null}
                </span>
                <span className="text-xs font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Quick actions</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid gap-2">
            {actions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No quick actions available for your role.
              </p>
            ) : (
              actions.map((a) => (
                <button
                  key={a.href + a.label}
                  type="button"
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 text-left text-sm font-medium transition-colors hover:bg-muted/60 active:scale-[0.98]"
                  onClick={() => {
                    setFabOpen(false);
                    router.push(a.href);
                  }}
                >
                  <a.icon className="h-5 w-5 text-brand" aria-hidden />
                  {a.label}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
