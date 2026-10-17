'use client';

import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type FilterSheetProps = {
  activeCount?: number;
  title?: string;
  resultLabel?: string;
  onReset?: () => void;
  children: React.ReactNode;
  triggerClassName?: string;
};

/** Bottom-sheet filters for mobile list pages (vaul Drawer). */
export function FilterSheet({
  activeCount = 0,
  title = 'Filters',
  resultLabel = 'Show results',
  onReset,
  children,
  triggerClassName,
}: FilterSheetProps) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('relative gap-2', triggerClassName)}
        >
          <Filter className="h-4 w-4" aria-hidden />
          Filters
          {activeCount > 0 ? (
            <Badge className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">{children}</div>
        <DrawerFooter className="gap-2 border-t border-border/60 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {onReset ? (
            <Button type="button" variant="ghost" onClick={onReset}>
              Reset
            </Button>
          ) : null}
          <DrawerClose asChild>
            <Button type="button" className="w-full">
              {resultLabel}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

type FilterChipProps = {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

export function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
      )}
    >
      {children}
    </button>
  );
}
