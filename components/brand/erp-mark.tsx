import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const;

type ErpMarkProps = {
  size?: keyof typeof SIZES;
  /** Icon-only square (collapsed sidebar / loading). Letters stay "ERP". */
  compact?: boolean;
  /** @deprecated Wordmark is always ERP. */
  showWordmark?: boolean;
  className?: string;
  /** @deprecated Wordmark is always ERP. */
  wordmarkClassName?: string;
  /** `sidebar` = light-on-dark nav; `chrome` = dark text on a light bar. */
  tone?: 'sidebar' | 'chrome';
};

/**
 * App chrome wordmark. Company name and logo stay off this mark.
 */
export function ErpMark({
  size = 'md',
  compact,
  className,
  wordmarkClassName,
  tone = 'sidebar',
}: ErpMarkProps) {
  const onSidebar = tone === 'sidebar';
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <span
        className={cn(
          'font-semibold uppercase tracking-[0.18em]',
          compact ? 'text-[11px] tracking-[0.12em]' : SIZES[size],
          onSidebar ? 'text-white' : 'text-foreground',
          wordmarkClassName
        )}
      >
        ERP
      </span>
    </div>
  );
}
