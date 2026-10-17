'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fobPreviewFromForm } from '@/lib/vehicle-lifecycle';

type Props = {
  bidJpy: string;
  expenseJpy: string;
  ttRate: string;
  onChange: (patch: { purchase_price?: string; expense_jpy?: string; tt_rate?: string }) => void;
  disabled?: boolean;
};

export function FobFormulaFields({ bidJpy, expenseJpy, ttRate, onChange, disabled }: Props) {
  const preview = fobPreviewFromForm(bidJpy, expenseJpy, ttRate);
  const hasBid = Number(bidJpy) > 0;

  return (
    <section className="space-y-1.5 rounded-xl border border-border/70 bg-muted/20 p-2">
      <div>
        <h3 className="text-xs font-semibold">Bid &amp; vehicle cost (FOB)</h3>
        <p className="text-xs text-muted-foreground">
          Vehicle cost (available) = FOB USD · FOB JPY = bid + 10% + expense · FOB USD = FOB JPY ÷ TT
        </p>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        <div className="space-y-0.5">
          <Label>Bid price (JPY)</Label>
          <Input
            type="number"
            inputMode="decimal"
            disabled={disabled}
            value={bidJpy}
            onChange={(e) => onChange({ purchase_price: e.target.value })}
            placeholder="Auction / purchase bid"
          />
        </div>
        <div className="space-y-0.5">
          <Label>Expense (JPY)</Label>
          <Input
            type="number"
            inputMode="decimal"
            disabled={disabled}
            value={expenseJpy}
            onChange={(e) => onChange({ expense_jpy: e.target.value })}
            placeholder="45000–65000"
          />
        </div>
        <div className="space-y-0.5">
          <Label>TT rate (JPY / USD)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            disabled={disabled}
            value={ttRate}
            onChange={(e) => onChange({ tt_rate: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5 rounded-md border border-border bg-background p-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <FormulaCell label="Bid" value={`¥${Math.round(preview.bidJpy).toLocaleString()}`} />
        <FormulaCell label="10%" value={`¥${Math.round(preview.markupJpy).toLocaleString()}`} />
        <FormulaCell label="Expense" value={`¥${Math.round(preview.expenseJpy).toLocaleString()}`} />
        <FormulaCell
          label="FOB JPY"
          value={hasBid ? `¥${Math.round(preview.fobJpy).toLocaleString()}` : '—'}
          emphasize
        />
        <FormulaCell label="TT" value={String(preview.ttRate)} />
        <FormulaCell
          label="FOB USD"
          value={hasBid ? `$${Math.round(preview.fobUsd).toLocaleString()}` : '—'}
          emphasize
        />
      </div>
    </section>
  );
}

function FormulaCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={emphasize ? 'font-semibold text-primary' : 'font-medium'}>{value}</p>
    </div>
  );
}
