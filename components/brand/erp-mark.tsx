import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-8 w-8', icon: 'h-3.5 w-3.5' },
  md: { box: 'h-10 w-10', icon: 'h-4 w-4' },
  lg: { box: 'h-14 w-14', icon: 'h-6 w-6' },
} as const;

type ErpMarkProps = {
  size?: keyof typeof SIZES;
  /** Icon-only square (collapsed sidebar / loading). */
  compact?: boolean;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
  /** `sidebar` = light-on-dark; `chrome` = works on light top bar. */
  tone?: 'sidebar' | 'chrome';
};

/**
 * Neutral ERP chrome mark — no company / product branding.
 * Official marks belong on printed trade documents only.
 */
export function ErpMark({
  size = 'md',
  compact,
  showWordmark = !compact,
  className,
  wordmarkClassName,
  tone = 'sidebar',
}: ErpMarkProps) {
  const s = SIZES[size];
  const onSidebar = tone === 'sidebar';
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-glass-sm backdrop-blur-md',
          s.box,
          onSidebar
            ? 'bg-white/15 ring-1 ring-white/20'
            : 'bg-brand/10 ring-1 ring-border/50'
        )}
        aria-hidden
      >
        <span
          className={cn(
            'rounded-md shadow-sm',
            s.icon,
            onSidebar ? 'bg-white/90' : 'bg-brand/80'
          )}
        />
      </span>
      {showWordmark ? (
        <div className={cn('min-w-0', wordmarkClassName)}>
          <p
            className={cn(
              'truncate text-sm font-semibold tracking-tight',
              onSidebar ? 'text-white' : 'text-foreground'
            )}
          >
            ERP
          </p>
          <p
            className={cn(
              'truncate text-[11px] font-medium uppercase tracking-[0.14em]',
              onSidebar ? 'text-white/50' : 'text-muted-foreground'
            )}
          >
            Workspace
          </p>
        </div>
      ) : null}
      <span className="sr-only">ERP</span>
    </div>
  );
}
