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
    <Card className={cn('border-border/60 hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', iconClassName || 'bg-primary/10 text-primary')}>
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tabular-nums">{value}</span>
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
