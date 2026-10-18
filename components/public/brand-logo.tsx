import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Master asset: public/brand/jct-logo.webp @ 1312×760 (≈1.726:1) */
export const JCT_LOGO_SRC = '/brand/jct-logo.webp';
export const JCT_LOGO_WIDTH = 1312;
export const JCT_LOGO_HEIGHT = 760;

type Props = {
  className?: string;
  markClassName?: string;
  /** Optional label beside the mark; omit / null for mark-only. */
  label?: string | null;
  /** header = large lockup; footer = smaller but readable */
  placement?: 'header' | 'footer';
};

/**
 * Official logo mark for public chrome (mark-only by default).
 * Landscape lockup — sizes are height-led so the wordmark in-art stays readable on ~375px.
 */
export function BrandLogo({
  className,
  markClassName,
  label = null,
  placement = 'header',
}: Props) {
  const isHeader = placement === 'header';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src={JCT_LOGO_SRC}
        alt=""
        width={JCT_LOGO_WIDTH}
        height={JCT_LOGO_HEIGHT}
        sizes={
          isHeader
            ? '(max-width: 640px) 110px, (max-width: 768px) 128px, 148px'
            : '(max-width: 640px) 96px, 120px'
        }
        className={cn(
          'h-auto w-auto shrink-0 object-contain',
          /* Mobile ~375: solid readable; md+ larger within header bar budget */
          isHeader
            ? 'h-14 w-[97px] sm:h-16 sm:w-[110px] md:h-[72px] md:w-[124px] lg:h-20 lg:w-[138px]'
            : 'h-11 w-[76px] sm:h-12 sm:w-[83px] md:h-14 md:w-[97px]',
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
    </span>
  );
}
