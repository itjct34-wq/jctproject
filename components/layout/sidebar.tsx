'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getNavGroupsForRoles } from '@/lib/nav';
import { usePermissions } from '@/hooks/use-permissions';
import { ErpMark } from '@/components/brand/erp-mark';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { NAV_GROUP_I18N, NAV_ITEM_I18N, useI18n } from '@/lib/i18n/locale-provider';
import { ChevronLeft, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

export function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { can, canView, roleNames, isAdmin, isSuperAdmin } = usePermissions();
  const navGroups = useMemo(() => getNavGroupsForRoles(roleNames), [roleNames]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const groupLabel = (label: string) => t(NAV_GROUP_I18N[label] || label, label);
  const itemLabel = (href: string, label: string) => t(NAV_ITEM_I18N[href] || label, label);

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
    <TooltipProvider delayDuration={200}>
    <aside
      className={cn(
        'erp-sidebar sticky top-0 flex h-[100dvh] flex-col border-r border-white/10 transition-all duration-300',
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
          <div className="min-w-0 flex-1 px-1">
            <ErpMark size="md" />
          </div>
        ) : (
          <ErpMark size="sm" compact showWordmark={false} />
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

          const isExpanded = group.flat || expandedGroup === group.label;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && !group.flat && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors',
                    mobile ? 'py-2.5' : 'py-1.5'
                  )}
                >
                  {groupLabel(group.label)}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-200',
                      isExpanded ? '' : '-rotate-90'
                    )}
                  />
                </button>
              )}

              {collapsed && !mobile ? (
                <div className="mx-2 my-1.5 h-px bg-white/10" aria-hidden />
              ) : null}

              {(isExpanded || collapsed) && (
                <div className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const isActive = isNavItemActive(pathname, searchParams, item.href);
                    const Icon = item.icon;
                    const label = itemLabel(item.href, item.label);
                    const link = (
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={collapsed ? label : undefined}
                        className={cn(
                          'relative flex items-center gap-3 rounded-2xl px-2.5 text-sm transition-all duration-200',
                          mobile ? 'min-h-11 py-3' : 'py-2.5',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-white/12 font-semibold text-white shadow-glass-sm ring-1 ring-white/15 backdrop-blur-md'
                            : 'text-muted-foreground hover:bg-white/8 hover:text-foreground'
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand shadow-[0_0_12px_hsl(var(--brand)/0.55)]"
                            aria-hidden
                          />
                        )}
                        <Icon
                          className={cn('h-[1.125rem] w-[1.125rem] shrink-0', isActive && 'text-brand')}
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                        {!collapsed && <span className="truncate tracking-tight">{label}</span>}
                      </Link>
                    );

                    if (collapsed && !mobile) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{label}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return <div key={item.href}>{link}</div>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/10 p-2">
        {(!collapsed || mobile) && (
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <span className="text-xs font-medium uppercase tracking-wider text-white/45">
              {t('common.language')}
            </span>
            <LanguageSwitcher compact={false} className="h-9 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" />
          </div>
        )}
        {collapsed && !mobile ? (
          <div className="flex justify-center py-1">
            <LanguageSwitcher className="text-white/70 hover:bg-white/10 hover:text-white" />
          </div>
        ) : null}
        {!mobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t('common.expand') : t('common.collapse')}
            className="flex w-full items-center justify-center rounded-xl px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          >
            {collapsed ? (
              <ChevronLeft className="h-4 w-4 rotate-180" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>{t('common.collapse')}</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
    </TooltipProvider>
  );
}
