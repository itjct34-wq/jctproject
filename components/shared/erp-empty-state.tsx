import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ErpEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

/** Shared empty / zero-results block for ERP lists and tables. */
export function ErpEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: ErpEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'erp-empty flex flex-col items-center justify-center text-center',
        compact ? 'p-8' : 'p-10 sm:p-12',
        className
      )}
    >
      {Icon ? <Icon className="mb-2 h-8 w-8 text-muted-foreground/50" aria-hidden /> : null}
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
