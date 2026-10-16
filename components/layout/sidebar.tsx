'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getNavGroupsForRoles } from '@/lib/nav';
import { usePermissions } from '@/hooks/use-permissions';
import { ChevronLeft, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { letterheadName } from '@/lib/jct-official';

function isNavItemActive(
  pathname: string,
  searchParams: { get: (key: string) => string | null },
  href: string
) {
  const [path, query] = href.split('?');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (!query) {
    if (path === '/vehicles') {
      const category = searchParams.get('category');
      return !category || category === 'car';
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  const wanted = new URLSearchParams(query);
  for (const [key, value] of wanted.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Rendered inside the phone/tablet drawer: bigger touch targets, close button. */
  mobile?: boolean;
  /** Called after a nav link is tapped (used to close the drawer). */
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, canView, roleNames, isAdmin, isSuperAdmin } = usePermissions();
  const navGroups = useMemo(() => getNavGroupsForRoles(roleNames), [roleNames]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('ERP');

  // Accordion: only one group open. Auto-expand the group that contains the active route.
  useEffect(() => {
    const active = navGroups.find((g) =>
      g.items.some((item) => isNavItemActive(pathname, searchParams, item.href))
    );
    if (active) setExpandedGroup(active.label);
  }, [pathname, searchParams, navGroups]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name, legal_name')
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setBrandName(letterheadName(data));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleGroup = (label: string) => {
    setExpandedGroup((prev) => (prev === label ? null : label));
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-[100dvh] flex-col border-r border-border bg-card shadow-[4px_0_20px_rgba(11,31,51,0.05)] transition-all duration-200',
        mobile ? 'w-72 max-w-[85vw]' : collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b-2 border-gold/50 bg-white',
          collapsed && !mobile ? 'h-[4.5rem] justify-center px-1.5' : 'min-h-[4.5rem] px-2.5 py-2'
        )}
      >
        {!collapsed || mobile ? (
          <div className="min-w-0 flex-1 px-1">
            <p className="text-sm font-semibold text-primary truncate">{brandName || 'ERP'}</p>
            <p className="text-[11px] text-muted-foreground truncate">Operations</p>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-primary/10">
            <span className="text-[10px] font-bold tracking-wide text-primary">
              {(brandName || 'ERP').slice(0, 3).toUpperCase()}
            </span>
          </div>
        )}
        {mobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.requiredRoles && !item.requiredRoles.some((role) => roleNames.includes(role))) {
              return false;
            }
            if (!item.module) return true;
            if (item.action) {
              // Permissions page: admins manage grants even without assign_roles in DB seed
              if (item.href === '/permissions') return isAdmin() || isSuperAdmin();
              return can(item.module, item.action);
            }
            return canView(item.module);
          });
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroup === group.label;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex items-center justify-between w-full px-3 text-[11px] font-semibold uppercase tracking-wider text-primary/70 hover:text-primary transition-colors',
                    mobile ? 'py-2.5' : 'py-1.5'
                  )}
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform',
                      isExpanded ? '' : '-rotate-90'
                    )}
                  />
                </button>
              )}

              {(isExpanded || collapsed) && (
                <div className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const isActive = isNavItemActive(pathname, searchParams, item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                          mobile ? 'py-3' : 'py-2',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                            : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {isActive && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!mobile && (
        <div className="border-t border-border p-2 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-full rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronLeft className="w-4 h-4 rotate-180" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
