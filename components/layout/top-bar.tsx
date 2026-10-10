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
    <header className="sticky top-0 z-30 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border flex items-center px-4 gap-3">
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden md:flex items-center text-sm text-muted-foreground">
        {today}
      </div>

      <div className="flex-1 max-w-md mx-auto">
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
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search stock #, chassis, make… (Enter)"
            className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-background"
            aria-label="Search vehicles"
          />
        </form>
      </div>

      <ThemeToggle />

      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <button aria-label="Notifications" className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-accent transition-colors">
            <Bell className="w-4.5 h-4.5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-primary rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
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
                        sales: '/sales',
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
                    'px-4 py-3 border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
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
          <button aria-label="User menu" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
            <Avatar className="w-8 h-8">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} />
              )}
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground leading-tight">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {roles[0]?.display_name || 'User'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden md:block" />
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
                      'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border',
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
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <User className="mr-2 h-4 w-4" />
            Profile & settings
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
