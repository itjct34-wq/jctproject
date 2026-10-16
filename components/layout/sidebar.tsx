'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getNavGroupsForRoles } from '@/lib/nav';
import { usePermissions } from '@/hooks/use-permissions';
import { ChevronLeft, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function isNavItemActive(
  pathname: string,
  searchParams: { get: (key: string) => string | null },
  href: string
) {
  const [path, query] = href.split('?');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (!query) {
    if (path === '/vehicles') {
      // Exact stock list only — do not highlight Cars when on /vehicles/lifecycle.
      if (pathname !== '/vehicles') return false;
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

function ErpMark({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm ring-1 ring-white/10">
        <span className="text-[11px] font-bold tracking-wider">ERP</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
        <span className="text-[10px] font-bold tracking-wide">ERP</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight text-white">ERP</p>
        <p className="truncate text-[10px] text-white/55">Operations</p>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, canView, roleNames, isAdmin, isSuperAdmin } = usePermissions();
  const navGroups = useMemo(() => getNavGroupsForRoles(roleNames), [roleNames]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Accordion: only one group open. Auto-expand the group that contains the active route.
  useEffect(() => {
    const active = navGroups.find((g) =>
      g.items.some((item) => isNavItemActive(pathname, searchParams, item.href))
    );
    if (active) setExpandedGroup(active.label);
  }, [pathname, searchParams, navGroups]);

  const toggleGroup = (label: string) => {
    setExpandedGroup((prev) => (prev === label ? null : label));
  };

  return (
    <aside
      className={cn(
        'erp-sidebar sticky top-0 flex h-[100dvh] flex-col border-r transition-all duration-200',
        mobile ? 'w-72 max-w-[85vw]' : collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border/60',
          collapsed && !mobile ? 'h-[4.25rem] justify-center px-1.5' : 'min-h-[4.25rem] px-2.5 py-2'
        )}
      >
        {!collapsed || mobile ? (
          <div className="min-w-0 flex-1">
            <ErpMark />
          </div>
        ) : (
          <ErpMark compact />
        )}
        {mobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
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
                    'flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors',
                    mobile ? 'py-2.5' : 'py-1.5'
                  )}
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-200',
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
                          'relative flex items-center gap-3 rounded-xl px-2.5 text-sm transition-colors duration-150',
                          mobile ? 'py-3' : 'py-2',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-brand/25 font-medium text-white shadow-sm'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand"
                            aria-hidden
                          />
                        )}
                        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-white')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
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
        <div className="shrink-0 border-t border-border/60 p-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center justify-center rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            {collapsed ? (
              <ChevronLeft className="h-4 w-4 rotate-180" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
