'use client';

import { useMemo, useState } from 'react';
import { Calculator, Ship, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currencies';

type Props = {
  listedPrice: number | null;
  currency: string;
  /** Nested inside the detail price card — skip outer panel chrome/padding. */
  embedded?: boolean;
};

type PriceTerm = 'FOB' | 'C&F' | 'CIF';

const fieldClass =
  'h-11 w-full min-w-0 max-w-full rounded-lg border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)] outline-none focus:border-[var(--jct-vermilion)] focus:ring-2 focus:ring-[var(--jct-vermilion)]/20 disabled:bg-[var(--jct-panel)] disabled:text-[var(--jct-muted-2)]';

export function PublicPriceEstimator({ listedPrice, currency, embedded = false }: Props) {
  const [term, setTerm] = useState<PriceTerm>('FOB');
  const [freight, setFreight] = useState('0');
  const [insurance, setInsurance] = useState('0');
  const base = Math.max(0, Number(listedPrice) || 0);
  const freightValue = Math.max(0, Number(freight) || 0);
  const insuranceValue = Math.max(0, Number(insurance) || 0);
  const total = useMemo(() => {
    if (term === 'C&F') return base + freightValue;
    if (term === 'CIF') return base + freightValue + insuranceValue;
    return base;
  }, [base, freightValue, insuranceValue, term]);

  return (
    <section className={embedded ? 'min-w-0 max-w-full' : 'jct-stock-panel min-w-0 max-w-full p-5 sm:p-6'}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--jct-vermilion)]/10 text-[var(--jct-vermilion)]">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-[var(--jct-navy)]">Shipping price estimator</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--jct-muted)]">
            Estimate FOB, C&amp;F, or CIF using the listed vehicle price. Confirm final freight and insurance with our team.
          </p>
        </div>
      </div>
      {listedPrice == null ? (
        <p className="mt-5 rounded-xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-4 text-sm text-[var(--jct-muted)]">
          Contact our team for the vehicle price and a shipping quote.
        </p>
      ) : (
        <>
          <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-3">
            <label className="min-w-0 space-y-1.5 text-sm font-medium text-[var(--jct-navy)]">
              Price term
              <select value={term} onChange={(e) => setTerm(e.target.value as PriceTerm)} className={fieldClass}>
                <option value="FOB">FOB — port of loading</option>
                <option value="C&F">C&amp;F — plus freight</option>
                <option value="CIF">CIF — freight + insurance</option>
              </select>
            </label>
            <label className="min-w-0 space-y-1.5 text-sm font-medium text-[var(--jct-navy)]">
              Freight ({currency})
              <input
                type="number"
                min="0"
                step="any"
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
                disabled={term === 'FOB'}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0 space-y-1.5 text-sm font-medium text-[var(--jct-navy)]">
              Insurance ({currency})
              <input
                type="number"
                min="0"
                step="any"
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                disabled={term !== 'CIF'}
                className={fieldClass}
              />
            </label>
          </div>
          <div className="mt-5 min-w-0 rounded-xl bg-[var(--jct-navy)] p-4 text-white shadow-[0_8px_24px_rgba(11,31,51,0.2)]">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Ship className="h-4 w-4 shrink-0" /> Estimated {term} total
            </div>
            <p className="mt-1 break-words font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {formatCurrency(total, currency)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-xs text-white/70">
              <span>Vehicle price</span>
              <span className="text-right">{formatCurrency(base, currency)}</span>
              {term !== 'FOB' && (
                <>
                  <span>Freight estimate</span>
                  <span className="text-right">{formatCurrency(freightValue, currency)}</span>
                </>
              )}
              {term === 'CIF' && (
                <>
                  <span>Insurance estimate</span>
                  <span className="text-right">{formatCurrency(insuranceValue, currency)}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--jct-muted-2)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--jct-navy)]" /> This is an estimate, not a confirmed offer. Final
        shipping costs depend on destination port, shipment type, and current carrier rates.
      </p>
    </section>
  );
}
