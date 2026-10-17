import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  markClassName?: string;
  /** Optional label shown beside the mark; omit for mark-only. */
  label?: string | null;
  /** header = large lockup; footer = smaller but readable */
  placement?: 'header' | 'footer';
};

/** JCT wordmark + official logo for public chrome. */
export function BrandLogo({
  className,
  markClassName,
  label = 'JCT',
  placement = 'header',
}: Props) {
  const isHeader = placement === 'header';
  const size = isHeader ? 40 : 32;
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Image
        src="/images/jct-official-logo.png"
        alt=""
        width={size}
        height={size}
        className={cn(
          'shrink-0 object-contain',
          isHeader ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-8 w-8',
          markClassName
        )}
        priority={isHeader}
      />
      {label ? (
        <span
          className={cn(
            'font-display font-bold tracking-tight text-[var(--jct-navy,#0b1f3a)]',
            isHeader ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg sm:text-xl'
          )}
        >
          {label}
        </span>
      ) : null}
      <span className="sr-only">JCT Export</span>
    </span>
  );
}
