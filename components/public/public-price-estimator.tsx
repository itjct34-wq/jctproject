'use client';

import { useMemo, useState } from 'react';
import { Calculator, Ship, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currencies';

type Props = {
  listedPrice: number | null;
  currency: string;
};

type PriceTerm = 'FOB' | 'C&F' | 'CIF';

export function PublicPriceEstimator({ listedPrice, currency }: Props) {
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Shipping price estimator</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">Estimate FOB, C&amp;F, or CIF using the listed vehicle price. Confirm final freight and insurance with our team.</p>
        </div>
      </div>
      {listedPrice == null ? (
        <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">Contact our team for the vehicle price and a shipping quote.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium text-zinc-700">
              Price term
              <select value={term} onChange={(e) => setTerm(e.target.value as PriceTerm)} className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100">
                <option value="FOB">FOB — port of loading</option>
                <option value="C&F">C&amp;F — plus freight</option>
                <option value="CIF">CIF — freight + insurance</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-zinc-700">
              Freight ({currency})
              <input type="number" min="0" step="any" value={freight} onChange={(e) => setFreight(e.target.value)} disabled={term === 'FOB'} className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-zinc-100 disabled:text-zinc-400" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-zinc-700">
              Insurance ({currency})
              <input type="number" min="0" step="any" value={insurance} onChange={(e) => setInsurance(e.target.value)} disabled={term !== 'CIF'} className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-zinc-100 disabled:text-zinc-400" />
            </label>
          </div>
          <div className="mt-5 rounded-xl bg-zinc-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm text-zinc-300"><Ship className="h-4 w-4" /> Estimated {term} total</div>
            <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{formatCurrency(total, currency)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-xs text-zinc-300">
              <span>Vehicle price</span><span className="text-right">{formatCurrency(base, currency)}</span>
              {term !== 'FOB' && <><span>Freight estimate</span><span className="text-right">{formatCurrency(freightValue, currency)}</span></>}
              {term === 'CIF' && <><span>Insurance estimate</span><span className="text-right">{formatCurrency(insuranceValue, currency)}</span></>}
            </div>
          </div>
        </>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-zinc-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> This is an estimate, not a confirmed offer. Final shipping costs depend on destination port, shipment type, and current carrier rates.</p>
    </section>
  );
}
