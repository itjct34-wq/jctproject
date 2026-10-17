import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE = {
  sm: { tile: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { tile: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
  lg: { tile: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6' },
} as const;

const TONE = {
  brand: 'bg-brand/10 text-brand ring-brand/20',
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  info: 'bg-info/10 text-info ring-info/25',
  neutral: 'bg-muted text-muted-foreground ring-border/60',
} as const;

type IconTileProps = {
  icon: LucideIcon;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  className?: string;
};

/** Tinted lucide tile for KPIs, empty states, mobile rows, and quick actions. */
export function IconTile({
  icon: Icon,
  size = 'md',
  tone = 'neutral',
  className,
}: IconTileProps) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center ring-1',
        s.tile,
        TONE[tone],
        className
      )}
      aria-hidden
    >
      <Icon className={s.icon} strokeWidth={1.75} />
    </span>
  );
}
