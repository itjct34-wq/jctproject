import type { LucideIcon } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
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
      {Icon ? (
        <div className="mb-3">
          <IconTile icon={Icon} size="lg" tone="neutral" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
