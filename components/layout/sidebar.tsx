'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '@/lib/nav';
import { usePermissions } from '@/hooks/use-permissions';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { canView } = usePermissions();
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
        'flex flex-col bg-white border-r border-border h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center gap-2.5 h-14 px-3 border-b border-border shrink-0">
        <img
          src="/images/705607377_122127683871150897_4165866362055650133_n.jpg"
          alt="Japan Circular Trading"
          className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">JCT ERP</p>
            <p className="text-[10px] text-muted-foreground truncate">Circular Trading</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.module || canView(item.module)
          );
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroups[group.label] ?? true;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 transition-transform',
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
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                          collapsed && 'justify-center',
                          isActive
                            ? 'bg-primary/8 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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

      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={onToggle}
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
    </aside>
  );
}
