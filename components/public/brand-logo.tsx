import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  markClassName?: string;
  /** Optional label; omit for a compact neutral wordmark. */
  label?: string;
  /** header = large lockup; footer = smaller but readable */
  placement?: 'header' | 'footer';
};

/** Text wordmark — logo images removed from product chrome. */
export function BrandLogo({
  className,
  markClassName,
  label = 'Export',
  placement = 'header',
}: Props) {
  const isHeader = placement === 'header';
  return (
    <span className={cn('flex items-center', className)}>
      <span
        className={cn(
          'font-display font-bold tracking-tight text-[var(--jct-navy,#0b1f3a)]',
          isHeader ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-xl',
          markClassName
        )}
      >
        {label}
      </span>
    </span>
  );
}
