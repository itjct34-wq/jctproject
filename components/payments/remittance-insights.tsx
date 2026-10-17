'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RemittanceCurrencyDashboard } from '@/components/payments/remittance-currency-dashboard';
import {
  aggregateRemittanceByCurrency,
  aggregateRemittanceByOffice,
  currenciesPresentInOfficeRows,
  remittanceCountByCurrency,
  type RemittanceOfficeRow,
} from '@/lib/remittance';
import type { Payment, PaymentAllocation } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/currencies';
import { cn } from '@/lib/utils';

const PIE_PALETTE = ['#E11D48', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#64748B', '#EC4899'];

type InsightPayment = Pick<
  Payment,
  | 'amount'
  | 'remit_amount'
  | 'instructed_amount'
  | 'bank_charges'
  | 'currency'
  | 'customer_id'
  | 'is_unknown'
  | 'allocation_status'
  | 'status'
  | 'office_id'
  | 'shift_id'
  | 'remit_date'
  | 'received_date'
  | 'payment_date'
  | 'created_at'
> & {
  payment_allocations?: Pick<PaymentAllocation, 'allocate_amount'>[] | null;
};

function money(value: number, currency: string) {
  return formatCurrency(value, currency, { showSymbol: true });
}

function CurrencyMixPie({
  slices,
}: {
  slices: Array<{ currency: string; count: number }>;
}) {
  if (slices.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No remittances in range</p>;
  }
  const data = slices.map((s, i) => ({
    name: s.currency,
    value: s.count,
    fill: PIE_PALETTE[i % PIE_PALETTE.length],
  }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="transparent"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} remittance${value === 1 ? '' : 's'}`, name]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {data.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: d.fill }} aria-hidden />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </div>
  );
}

function OfficeSharePie({
  rows,
  currency,
}: {
  rows: RemittanceOfficeRow[];
  currency: string | 'count';
}) {
  const data = rows
    .map((row, i) => ({
      name: row.label,
      value: currency === 'count' ? row.count : Number(row.byCurrency[currency]) || 0,
      fill: PIE_PALETTE[i % PIE_PALETTE.length],
    }))
    .filter((d) => d.value > 0)
    .slice(0, 8);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No office volume for this view</p>;
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={74}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="transparent"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) =>
              currency === 'count'
                ? [`${value}`, 'Remittances']
                : [money(Number(value) || 0, currency), currency]
            }
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

function OfficeBars({ rows }: { rows: RemittanceOfficeRow[] }) {
  const top = rows.slice(0, 10);
  if (top.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No office activity in range</p>;
  }
  const chartData = top.map((r) => ({
    label: r.label.length > 28 ? `${r.label.slice(0, 26)}…` : r.label,
    full: r.label,
    count: r.count,
  }));
  const height = Math.max(180, chartData.length * 36);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <Tooltip
            formatter={(value: number) => [`${value}`, 'Remittances']}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.full as string) || ''}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#E11D48" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RemittanceInsights({
  payments,
  officeNames,
  shiftNames,
  from,
  to,
  onFromChange,
  onToChange,
  onResetRange,
  className,
}: {
  payments: InsightPayment[];
  officeNames: Record<string, string>;
  shiftNames: Record<string, string>;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onResetRange: () => void;
  className?: string;
}) {
  const currencyTotals = useMemo(() => aggregateRemittanceByCurrency(payments), [payments]);
  const countMix = useMemo(() => remittanceCountByCurrency(payments), [payments]);
  const officeRows = useMemo(
    () =>
      aggregateRemittanceByOffice(payments, {
        offices: officeNames,
        shifts: shiftNames,
      }),
    [payments, officeNames, shiftNames]
  );
  const currencyCols = useMemo(() => currenciesPresentInOfficeRows(officeRows), [officeRows]);
  const [officePieMode, setOfficePieMode] = useState<string>('count');

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="glass-panel-strong border-border/50">
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base tracking-tight">Remittance insights</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Per-currency ledgers, allocation mix, and office volume — amounts stay in their own currency.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={onResetRange}>
              Reset
            </Button>
          </div>
        </CardHeader>
      </Card>

      <RemittanceCurrencyDashboard totals={currencyTotals} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="glass-panel-strong border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Remittance mix by currency</CardTitle>
            <p className="text-xs text-muted-foreground">Share of remittance count (not FX-mixed amounts)</p>
          </CardHeader>
          <CardContent>
            <CurrencyMixPie slices={countMix} />
          </CardContent>
        </Card>

        <Card className="glass-panel-strong border-border/50">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Office share</CardTitle>
              <p className="text-xs text-muted-foreground">Top offices in the selected measure</p>
            </div>
            <Select value={officePieMode} onValueChange={setOfficePieMode}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">By count</SelectItem>
                {currencyCols.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} amounts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <OfficeSharePie rows={officeRows} currency={officePieMode === 'count' ? 'count' : officePieMode} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel-strong border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Remittances handled by office</CardTitle>
          <p className="text-xs text-muted-foreground">Ranked by count · shift shown when recorded</p>
        </CardHeader>
        <CardContent>
          <OfficeBars rows={officeRows} />
        </CardContent>
      </Card>

      {officeRows.length > 0 ? (
        <Card className="glass-panel-strong border-border/50 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Office ledgers</CardTitle>
            <p className="text-xs text-muted-foreground">
              Only currencies with activity appear — no empty dash columns.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Office</th>
                  <th className="px-3 py-2.5 font-medium">Txns</th>
                  {currencyCols.map((code) => (
                    <th key={code} className="px-3 py-2.5 font-medium tabular-nums">
                      {code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {officeRows.map((row) => (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground/90">{row.label}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex min-w-[1.75rem] justify-center rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">
                        {row.count}
                      </span>
                    </td>
                    {currencyCols.map((code) => {
                      const total = row.byCurrency[code] || 0;
                      return (
                        <td key={code} className="px-3 py-2.5 tabular-nums text-foreground/90">
                          {total > 0 ? money(total, code) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
