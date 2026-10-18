import Image from 'next/image';
import {
  JCT_LOGO_HEIGHT,
  JCT_LOGO_SRC,
  JCT_LOGO_WIDTH,
} from '@/components/public/brand-logo';
import { cn } from '@/lib/utils';

/** Landscape-aware boxes — logo art is ~1.726:1 */
const SIZES = {
  sm: {
    box: 'h-9 w-[3.875rem]',
    img: 'h-7 w-[3rem]',
    sizes: '48px',
  },
  md: {
    box: 'h-12 w-[5.25rem]',
    img: 'h-10 w-[4.375rem]',
    sizes: '70px',
  },
  lg: {
    box: 'h-14 w-[6.25rem]',
    img: 'h-12 w-[5.25rem]',
    sizes: '84px',
  },
} as const;

type ErpMarkProps = {
  size?: keyof typeof SIZES;
  /** Icon-only square (collapsed sidebar / loading). Kept for callers; mark is always icon-only. */
  compact?: boolean;
  /** @deprecated Wordmark copy removed — slot stays empty. */
  showWordmark?: boolean;
  className?: string;
  /** @deprecated Wordmark copy removed — slot stays empty. */
  wordmarkClassName?: string;
  /** `sidebar` = light pad on dark nav; `chrome` = light top bar. */
  tone?: 'sidebar' | 'chrome';
};

/**
 * ERP chrome mark — mark-only (no accompanying text).
 * Uses the official JCT lockup on a light pad so dark-in-art text stays readable.
 */
export function ErpMark({
  size = 'md',
  className,
  tone = 'sidebar',
}: ErpMarkProps) {
  const s = SIZES[size];
  const onSidebar = tone === 'sidebar';
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl px-1.5 shadow-glass-sm backdrop-blur-md',
          s.box,
          onSidebar
            ? 'bg-white/95 ring-1 ring-white/25'
            : 'bg-white ring-1 ring-border/50'
        )}
        aria-hidden
      >
        <Image
          src={JCT_LOGO_SRC}
          alt=""
          width={JCT_LOGO_WIDTH}
          height={JCT_LOGO_HEIGHT}
          sizes={s.sizes}
          className={cn('object-contain', s.img)}
        />
      </span>
    </div>
  );
}
