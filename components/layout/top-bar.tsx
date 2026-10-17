'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Bell, Search, Settings, LogOut, Menu, ChevronDown, User } from 'lucide-react';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/lib/types';
import { format } from 'date-fns';
import { ErpMark } from '@/components/brand/erp-mark';
import { NAV_GROUPS } from '@/lib/nav';
import { NAV_ITEM_I18N, useI18n } from '@/lib/i18n/locale-provider';

function notificationHref(n: Notification): string | null {
  if (!n.related_module) return null;
  const map: Record<string, string> = {
    tasks: '/tasks',
    invoices: '/invoices',
    sales: '/vehicles',
    vehicles: '/vehicles',
    payments: '/payments',
    shipments: '/shipments',
    customers: '/customers',
    inquiries: '/inquiries',
    quotations: '/quotations',
    expenses: '/expenses',
  };
  const base = map[n.related_module];
  if (!base) return null;
  if (n.related_id && ['invoices', 'payments', 'vehicles', 'customers', 'quotations'].includes(n.related_module)) {
    return `${base}/${n.related_id}`;
  }
  return base;
}

function pageTitleFromPath(pathname: string, t: (path: string, fallback?: string) => string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const path = item.href.split('?')[0];
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        return t(NAV_ITEM_I18N[item.href] || item.label, item.label);
      }
    }
  }
  if (pathname.startsWith('/profile')) return t('common.myProfile');
  return t('common.workspace', 'Workspace');
}

export function TopBar({
  onMenuClick,
  onOpenPalette,
}: {
  onMenuClick: () => void;
  onOpenPalette?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const { profile, roles, signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const today = format(new Date(), 'EEEE, MMM d, yyyy');
  const pageTitle = pageTitleFromPath(pathname, t);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const [listRes, countRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('is_read', false),
      ]);
      if (listRes.data) setNotifications(listRes.data as Notification[]);
      setUnreadCount(countRes.count ?? 0);
    };
    void load();
  }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const bellLabel =
    unreadCount > 0
      ? `${t('common.notifications')}, ${unreadCount}`
      : t('common.notifications');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/30 bg-card/55 px-3 shadow-glass-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-card/40 sm:gap-3 sm:px-4">
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="lg:hidden -ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl hover:bg-muted/70 active:scale-95"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <ErpMark size="sm" compact showWordmark={false} tone="chrome" />
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{pageTitle}</p>
      </div>

      <div className="hidden items-center text-sm text-muted-foreground md:flex">
        {today}
      </div>

      <div className="mx-auto hidden min-w-0 max-w-md flex-1 md:block">
        <button
          type="button"
          onClick={() => onOpenPalette?.()}
          className="relative flex h-10 w-full items-center rounded-full border border-border/40 bg-card/65 px-3.5 text-left text-sm text-muted-foreground shadow-glass-sm backdrop-blur-xl transition-colors hover:bg-card/90"
          aria-label={t('common.quickActions')}
        >
          <Search className="mr-2.5 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t('common.searchOrJump', 'Search or jump to…')}</span>
          <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted/70 px-1.5 font-mono text-[10px] font-medium lg:inline-flex">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          aria-label={t('common.quickActions')}
          className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-muted/70 md:hidden"
          onClick={() => onOpenPalette?.()}
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>

        <LanguageSwitcher className="hidden sm:inline-flex" />
        <ThemeToggle />

        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={bellLabel}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted/70 md:h-9 md:w-9 md:rounded-xl"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-brand-foreground shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-[20rem] border-border/50 bg-card/95 p-0 shadow-glass backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-sm font-semibold">{t('common.notifications')}</span>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs text-brand hover:underline">
                  {t('common.markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('common.noNotifications')}
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn(
                      'cursor-pointer rounded-none border-b border-border/50 px-4 py-3 focus:bg-accent/50',
                      !n.is_read && 'bg-brand/5'
                    )}
                    onSelect={async () => {
                      if (!n.is_read) {
                        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                      const href = notificationHref(n);
                      setNotifOpen(false);
                      if (href) router.push(href);
                      else router.push('/notifications');
                    }}
                  >
                    <div className="flex w-full items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
                        {n.message && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(n.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <div className="border-t border-border/60 p-2">
              <DropdownMenuItem
                className="justify-center text-sm font-medium text-brand"
                onSelect={() => {
                  setNotifOpen(false);
                  router.push('/notifications');
                }}
              >
                {t('common.viewAll')}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className="flex shrink-0 items-center gap-2 rounded-2xl px-1 py-1.5 transition-colors hover:bg-muted/70 sm:px-2"
            >
              <Avatar className="h-8 w-8 rounded-full ring-2 ring-border/60">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} className="object-cover" />
                )}
                <AvatarFallback className="rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-foreground">
                  {profile?.full_name || profile?.email}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {roles[0]?.display_name || 'User'}
                </p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{profile?.full_name || profile?.email}</p>
                <div className="flex flex-wrap gap-1">
                  {roles.map((role) => (
                    <span
                      key={role.id}
                      className={cn(
                        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
                        ROLE_COLORS[role.name]
                      )}
                    >
                      {role.display_name}
                    </span>
                  ))}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              {t('common.myProfile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              {t('common.systemSettings')}
            </DropdownMenuItem>
            <div className="px-2 py-1.5 sm:hidden">
              <LanguageSwitcher compact={false} className="w-full justify-start border border-border/50" />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t('common.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </header>
  );
}
