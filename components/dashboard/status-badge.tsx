'use client';

import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/35',
  available: 'bg-success/15 text-success border-success/35',
  completed: 'bg-success/15 text-success border-success/35',
  shipped: 'bg-info/15 text-info border-info/35',
  reserved: 'bg-warning/15 text-warning border-warning/40',
  pending: 'bg-warning/15 text-warning border-warning/40',
  in_progress: 'bg-info/15 text-info border-info/35',
  partially_paid: 'bg-warning/15 text-warning border-warning/40',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/35',
  overdue: 'bg-destructive/15 text-destructive border-destructive/35',
  draft: 'bg-muted text-foreground/70 border-border',
  inactive: 'bg-muted text-foreground/70 border-border',
  auction_won: 'bg-success/15 text-success border-success/35',
  bidding: 'bg-info/15 text-info border-info/35',
  in_yard: 'bg-gold/15 text-gold-foreground border-gold/40',
  in_transit: 'bg-info/15 text-info border-info/35',
  delivered: 'bg-success/15 text-success border-success/35',
  fully_paid: 'bg-success/15 text-success border-success/35',
  default: 'bg-muted text-foreground/75 border-border',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const styleKey = status.toLowerCase().replace(/\s+/g, '_');
  const style = STATUS_STYLES[styleKey] || STATUS_STYLES.default;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        style,
        className
      )}
    >
      {label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
