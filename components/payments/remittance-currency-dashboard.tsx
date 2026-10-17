'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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

const STATUS_COLORS = {
  unallocated: '#E11D48',
  partial: '#F59E0B',
  allocated: '#10B981',
} as const;

const STATUS_LABELS = {
  unallocated: 'Unallocated',
  partial: 'Partial',
  allocated: 'Allocated',
} as const;

function StatusPie({ totals }: { totals: RemittanceCurrencyTotals }) {
  const slices = (
    [
      ['unallocated', totals.status.unallocated],
      ['partial', totals.status.partial],
      ['allocated', totals.status.allocated],
    ] as const
  )
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key,
      name: STATUS_LABELS[key],
      value,
      fill: STATUS_COLORS[key],
    }));

  if (slices.length === 0) {
    return (
      <div className="flex h-[132px] items-center justify-center text-xs text-muted-foreground">
        No remit data
      </div>
    );
  }

  return (
    <div className="mx-auto h-[132px] w-full max-w-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={36}
            outerRadius={58}
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="transparent"
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={slice.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => money(Number(value) || 0, totals.currency)}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CurrencyCard({ totals }: { totals: RemittanceCurrencyTotals }) {
  const symbol = CURRENCY_SYMBOLS[totals.currency as SupportedCurrency] || totals.currency;
  const high = totals.allocatedPct >= REMITTANCE_ALLOCATED_RING_THRESHOLD;

  return (
    <Card className="glass-panel-strong border-border/50">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Payments received · {totals.currency}
          </p>
          <p className="text-xl font-bold tracking-tight text-primary tabular-nums">
            <span className="mr-1.5 text-brand">{symbol}</span>
            {money(totals.remit, totals.currency)}
          </p>
          <p className="text-xs text-muted-foreground">{totals.currency} ledger</p>
        </div>

        <div>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Allocation status
          </p>
          <StatusPie totals={totals} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((key) => (
              <span key={key} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: STATUS_COLORS[key] }}
                  aria-hidden
                />
                {STATUS_LABELS[key]}
              </span>
            ))}
          </div>
          <p
            className={cn(
              'mt-2 text-center text-xs font-semibold tabular-nums',
              high ? 'text-emerald-600' : 'text-rose-600'
            )}
          >
            {totals.allocatedPct.toFixed(1)}% allocated
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
  if (totals.length === 0) {
    return (
      <Card className={cn('glass-panel-strong border-border/50', className)}>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No remittance totals yet — amounts appear here per currency once T/Ts are recorded.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {totals.map((row) => (
        <CurrencyCard key={row.currency} totals={row} />
      ))}
    </div>
  );
}
