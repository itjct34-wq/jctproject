'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Gauge,
  Car,
  ListTodo,
  MoreHorizontal,
  Plus,
  MessagesSquare,
  CalendarClock,
  WalletCards,
  CloudUpload,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useI18n } from '@/lib/i18n/locale-provider';
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

export function MobileTabBar({ onMore }: MobileTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
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

  const tabs = [
    { id: 'home', label: t('mobile.home'), href: '/dashboard', icon: Gauge },
    { id: 'stock', label: t('mobile.stock'), href: '/vehicles', icon: Car },
    { id: 'fab', label: t('mobile.new'), href: null, icon: Plus },
    { id: 'tasks', label: t('mobile.tasks'), href: '/tasks', icon: ListTodo },
    { id: 'more', label: t('mobile.more'), href: null, icon: MoreHorizontal },
  ] as const;

  const actions = [
    can('customers', 'create')
      ? { label: t('mobile.newInquiry'), href: '/inquiries', icon: MessagesSquare }
      : null,
    can('vehicles', 'edit')
      ? { label: t('mobile.reserveVehicle'), href: '/vehicles', icon: CalendarClock }
      : null,
    can('expenses', 'create')
      ? { label: t('mobile.addExpense'), href: '/expenses', icon: WalletCards }
      : null,
    can('vehicles', 'import')
      ? { label: t('mobile.uploadStock'), href: '/bulk-upload', icon: CloudUpload }
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
          'fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-card/75 shadow-[0_-8px_32px_hsl(220_22%_12%/0.08)] backdrop-blur-2xl transition-transform duration-300 lg:hidden',
          'pb-[env(safe-area-inset-bottom)]',
          hidden && 'translate-y-full'
        )}
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
          {tabs.map((tab) => {
            const active =
              tab.href != null &&
              (pathname === tab.href ||
                (tab.href !== '/dashboard' && pathname.startsWith(tab.href)));
            if (tab.id === 'fab') {
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label={t('common.quickActions')}
                  onClick={() => setFabOpen(true)}
                  className="-mt-4 flex flex-col items-center justify-end gap-0.5 pb-1"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-glass ring-4 ring-background/90 transition-transform active:scale-95">
                    <Plus className="h-6 w-6" strokeWidth={2.25} />
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
                  className="flex min-h-12 min-w-[3.75rem] flex-col items-center justify-center gap-0.5 text-muted-foreground active:scale-95"
                >
                  <span className="flex h-9 w-12 items-center justify-center rounded-2xl">
                    <tab.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-[11px] font-semibold tracking-tight">{tab.label}</span>
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
                  'flex min-h-12 min-w-[3.75rem] flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-95',
                  active ? 'text-brand' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-12 items-center justify-center rounded-2xl transition-colors duration-150',
                    active && 'bg-brand/12 shadow-glass-sm'
                  )}
                >
                  <tab.icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {active ? (
                    <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand shadow-[0_0_8px_hsl(var(--brand)/0.7)]" />
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border/40 bg-card/95 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-glass backdrop-blur-2xl"
        >
          <SheetHeader>
            <SheetTitle>{t('common.quickActions')}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid gap-2">
            {actions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('mobile.noQuickActions')}
              </p>
            ) : (
              actions.map((a) => (
                <button
                  key={a.href + a.label}
                  type="button"
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/50 bg-card/80 px-4 text-left text-sm font-semibold shadow-glass-sm backdrop-blur-md transition-colors hover:bg-muted/60 active:scale-[0.98]"
                  onClick={() => {
                    setFabOpen(false);
                    router.push(a.href);
                  }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <a.icon className="h-5 w-5" aria-hidden />
                  </span>
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
