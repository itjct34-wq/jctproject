'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '@/lib/nav';
import { usePermissions } from '@/hooks/use-permissions';
import { ChevronLeft, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { canView, roleNames } = usePermissions();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      initial[g.label] = g.items.some((item) => pathname.startsWith(item.href));
    });
    setExpandedGroups(initial);
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-card border-r border-border h-[100dvh] sticky top-0 transition-all duration-200',
        mobile ? 'w-72 max-w-[85vw]' : collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center gap-2.5 h-14 px-3 border-b border-border shrink-0">
        <img
          src="/images/705607377_122127683871150897_4165866362055650133_n-removebg-preview.png"
          alt="Japan Circular Trading"
          className="w-9 h-9 rounded-lg object-contain bg-white border border-border shrink-0 p-0.5"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">JCT ERP</p>
            <p className="text-[11px] text-muted-foreground truncate">Circular Trading</p>
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
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) =>
              (!item.requiredRoles || item.requiredRoles.some((role) => roleNames.includes(role))) &&
              (!item.module || canView(item.module))
          );
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroups[group.label] ?? true;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex items-center justify-between w-full px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors',
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
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-2.5 text-sm transition-colors',
                          mobile ? 'py-3' : 'py-2',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {isActive && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
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
