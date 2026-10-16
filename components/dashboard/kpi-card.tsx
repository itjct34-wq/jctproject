'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  trendDirection?: 'up' | 'down' | 'neutral';
  className?: string;
  iconClassName?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  trendDirection = 'neutral',
  className,
  iconClassName,
}: KpiCardProps) {
  const TrendIcon =
    trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/50 hover:border-brand/25 hover:shadow-glass transition-all duration-200 hover:-translate-y-0.5',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl',
                iconClassName || 'bg-brand/10 text-brand'
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</span>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <span
              className={cn(
                'flex items-center gap-0.5 font-medium',
                trendDirection === 'up' && 'text-success',
                trendDirection === 'down' && 'text-destructive',
                trendDirection === 'neutral' && 'text-muted-foreground'
              )}
            >
              <TrendIcon className="w-3 h-3" />
              {Math.abs(trend.value)}%
            </span>
            {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
