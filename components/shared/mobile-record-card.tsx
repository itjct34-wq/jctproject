'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
import { cn } from '@/lib/utils';

type MobileRecordCardProps = {
  href?: string;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  amount?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
  thumbnailUrl?: string | null;
  className?: string;
};

/** Mobile list row: leading tile/thumb, title, status, amount, chevron. */
export function MobileRecordCard({
  href,
  onClick,
  title,
  subtitle,
  status,
  amount,
  icon,
  tone = 'neutral',
  thumbnailUrl,
  className,
}: MobileRecordCardProps) {
  const body = (
    <>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border/60"
        />
      ) : icon ? (
        <IconTile icon={icon} size="md" tone={tone} />
      ) : (
        <span className="h-10 w-10 shrink-0 rounded-xl bg-muted ring-1 ring-border/60" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {amount ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{amount}</span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        {status ? <div className="mt-1.5">{status}</div> : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );

  const classes = cn(
    'flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3 shadow-sm transition-transform active:scale-[0.98]',
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(classes, 'w-full text-left')}>
      {body}
    </button>
  );
}
