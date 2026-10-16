'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Input } from '@/components/ui/input';
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
import { Bell, Search, Settings, LogOut, Menu, ChevronDown, User } from 'lucide-react';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import type { Notification } from '@/lib/types';
import { format } from 'date-fns';

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { profile, roles, signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const today = format(new Date(), 'EEEE, MMM d, yyyy');

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[]);
      });
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/50 bg-card/70 px-3 shadow-glass-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 sm:gap-3 sm:px-4">
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="lg:hidden -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-muted/70"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center text-sm text-muted-foreground md:flex">
        {today}
      </div>

      <div className="mx-auto min-w-0 max-w-md flex-1">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQ.trim();
            if (!q) return;
            router.push(`/vehicles?q=${encodeURIComponent(q)}`);
            setSearchQ('');
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search vehicles…"
            className="h-9 rounded-full border-border/50 bg-muted/40 pl-9 focus-visible:bg-background/90"
            aria-label="Search vehicles"
          />
        </form>
      </div>

      <ThemeToggle />

      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Notifications"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted/70 md:h-9 md:w-9"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
                {unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-[20rem] p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={async () => {
                    if (!n.is_read) {
                      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                      setNotifications((prev) =>
                        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                      );
                    }
                    if (n.related_module && n.related_id) {
                      const map: Record<string, string> = {
                        tasks: '/tasks',
                        invoices: '/invoices',
                        sales: '/vehicles',
                        vehicles: '/vehicles',
                        payments: '/payments',
                        shipments: '/shipments',
                      };
                      const href = map[n.related_module];
                      if (href) {
                        setNotifOpen(false);
                        router.push(href);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') (e.currentTarget as HTMLElement).click();
                  }}
                  className={cn(
                    'cursor-pointer border-b border-border/50 px-4 py-3 transition-colors hover:bg-accent/50',
                    !n.is_read && 'bg-brand/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {format(new Date(n.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="User menu"
            className="flex shrink-0 items-center gap-2 rounded-xl px-1 py-1.5 transition-colors hover:bg-muted/70 sm:px-2"
          >
            <Avatar className="h-8 w-8 ring-2 ring-border/60">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} />
              )}
              <AvatarFallback className="bg-brand/10 text-xs font-semibold text-brand">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium leading-tight text-foreground">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground">
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
                      'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium',
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
            My profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            System Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
