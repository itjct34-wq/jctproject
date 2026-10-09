'use client';

import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  available: 'bg-success/10 text-success border-success/20',
  completed: 'bg-success/10 text-success border-success/20',
  shipped: 'bg-info/10 text-info border-info/20',
  reserved: 'bg-warning/10 text-warning border-warning/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  in_progress: 'bg-info/10 text-info border-info/20',
  partially_paid: 'bg-warning/10 text-warning border-warning/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  overdue: 'bg-destructive/10 text-destructive border-destructive/20',
  draft: 'bg-muted text-muted-foreground border-border',
  inactive: 'bg-muted text-muted-foreground border-border',
  auction_won: 'bg-success/10 text-success border-success/20',
  bidding: 'bg-info/10 text-info border-info/20',
  in_yard: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  in_transit: 'bg-info/10 text-info border-info/20',
  delivered: 'bg-success/10 text-success border-success/20',
  fully_paid: 'bg-success/10 text-success border-success/20',
  default: 'bg-muted text-muted-foreground border-border',
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
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap',
        style,
        className
      )}
    >
      {label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
