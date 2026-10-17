'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { usePermissions } from '@/hooks/use-permissions';
import { QUICK_ACTIONS, type QuickAction } from '@/lib/quick-actions';
import { useI18n } from '@/lib/i18n/locale-provider';

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function filterActions(
  actions: QuickAction[],
  can: (module: NonNullable<QuickAction['module']>, action: NonNullable<QuickAction['action']>) => boolean,
  canView: (module: NonNullable<QuickAction['viewModule']>) => boolean
) {
  return actions.filter((a) => {
    if (a.module && a.action) return can(a.module, a.action);
    if (a.viewModule) return canView(a.viewModule);
    return true;
  });
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { can, canView } = usePermissions();

  const visible = useMemo(
    () => filterActions(QUICK_ACTIONS, can, canView),
    [can, canView]
  );

  const createActions = visible.filter((a) => a.group === 'create');
  const navigateActions = visible.filter((a) => a.group === 'navigate');

  const run = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`${t('common.quickActions')}…`} />
      <CommandList className="max-h-[min(70dvh,22rem)]">
        <CommandEmpty>{t('mobile.noQuickActions')}</CommandEmpty>
        {createActions.length > 0 ? (
          <CommandGroup heading="Create">
            {createActions.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.label} ${a.keywords || ''}`}
                onSelect={() => run(a.href)}
                className="min-h-11 gap-2 rounded-xl md:min-h-9"
              >
                <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {navigateActions.length > 0 ? (
          <CommandGroup heading="Go to">
            {navigateActions.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.label} ${a.keywords || ''}`}
                onSelect={() => run(a.href)}
                className="min-h-11 gap-2 rounded-xl md:min-h-9"
              >
                <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      <div className="hidden items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground sm:flex">
        <span>Navigate with arrows · Enter to open</span>
        <CommandShortcut className="static ml-0">Esc</CommandShortcut>
      </div>
    </CommandDialog>
  );
}

/** Global Ctrl/Cmd+K listener + shared open state for FAB / search. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        // Still allow Ctrl+K from search fields so the palette is reachable.
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          /* allow */
        } else {
          return;
        }
      }
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen };
}

