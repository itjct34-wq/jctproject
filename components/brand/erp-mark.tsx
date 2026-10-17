import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-8 w-8', px: 32 },
  md: { box: 'h-10 w-10', px: 40 },
  lg: { box: 'h-14 w-14', px: 56 },
} as const;

type ErpMarkProps = {
  size?: keyof typeof SIZES;
  /** Icon-only square (collapsed sidebar / loading). */
  compact?: boolean;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

/** Official JCT mark for ERP chrome (sidebar, login, loading). */
export function ErpMark({
  size = 'md',
  compact,
  showWordmark = !compact,
  className,
  wordmarkClassName,
}: ErpMarkProps) {
  const s = SIZES[size];
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 shadow-glass-sm ring-1 ring-white/35 backdrop-blur-md',
          s.box
        )}
      >
        <Image
          src="/images/jct-official-logo.png"
          alt=""
          width={s.px}
          height={s.px}
          className="h-full w-full object-contain p-0.5"
          priority
        />
      </span>
      {showWordmark ? (
        <div className={cn('min-w-0', wordmarkClassName)}>
          <p className="truncate text-sm font-semibold tracking-tight text-white">JCT ERP</p>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
            Operations
          </p>
        </div>
      ) : null}
      <span className="sr-only">JCT ERP</span>
    </div>
  );
}
