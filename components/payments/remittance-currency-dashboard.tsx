'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  REMITTANCE_ALLOCATED_RING_THRESHOLD,
  type RemittanceCurrencyTotals,
} from '@/lib/remittance';
import { CURRENCY_SYMBOLS, formatCurrency, type SupportedCurrency } from '@/lib/utils/currencies';
import { cn } from '@/lib/utils';

function money(value: number, currency: string) {
  return formatCurrency(value, currency, { showSymbol: true });
}

function AllocatedRing({
  pct,
  high,
}: {
  pct: number;
  high: boolean;
}) {
  const size = 132;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * c;
  const ringColor = high ? '#10B981' : '#E11D48';

  return (
    <div className="relative mx-auto h-[132px] w-[132px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E8ECF1"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[1.65rem] font-bold leading-none tracking-tight text-primary">
          {clamped.toFixed(1)}%
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Allocated
        </span>
      </div>
    </div>
  );
}

function CurrencyCard({ totals }: { totals: RemittanceCurrencyTotals }) {
  const symbol = CURRENCY_SYMBOLS[totals.currency as SupportedCurrency] || totals.currency;
  const high = totals.allocatedPct >= REMITTANCE_ALLOCATED_RING_THRESHOLD;

  return (
    <Card className="border-border/70 shadow-[0_6px_22px_rgba(11,31,51,0.06)]">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-bold tracking-tight text-primary">
            <span className="mr-1.5 text-gold">{symbol}</span>
            {totals.currency}
          </p>
          <p className="text-right text-xs font-medium text-muted-foreground">
            Remit <span className="font-semibold text-foreground/80">{money(totals.remit, totals.currency)}</span>
          </p>
        </div>

        <AllocatedRing pct={totals.allocatedPct} high={high} />

        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Unallocated
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-rose-600">
            {money(totals.unallocated, totals.currency)}
          </p>
        </div>

        <div className="space-y-2 border-t border-dashed border-border/80 pt-3 text-sm">
          {(
            [
              ['Instructed', totals.instructed],
              ['Allocated', totals.allocated],
              ['Bank charges', totals.bankCharges],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums text-primary">
                {money(value, totals.currency)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RemittanceCurrencyDashboard({
  totals,
  className,
}: {
  totals: RemittanceCurrencyTotals[];
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {totals.map((row) => (
        <CurrencyCard key={row.currency} totals={row} />
      ))}
    </div>
  );
}
