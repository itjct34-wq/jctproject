/**
 * JCT vehicle cost & selling-price helpers
 *
 * Cycle:
 *  1. Agent wins bid at auction → vehicle enters stock
 *  2. Cost (JPY) = bid + 10% markup + 45,000 JPY fixed expense
 *  3. Cost (USD) = costJPY / exchangeRate + profitUSD
 *  4. That base is FOB. Adding freight → C&F. Adding insurance → CIF.
 */

export const FIXED_EXPENSE_JPY = 45_000;
export const DEFAULT_MARKUP_RATE = 0.1; // 10%

export type PriceTerm = 'FOB' | 'C&F' | 'CIF' | 'CNF';

export type CostBreakdown = {
  bidJpy: number;
  markupRate: number;
  markupJpy: number;
  fixedExpenseJpy: number;
  totalCostJpy: number;
  exchangeRate: number; // JPY per 1 USD
  costUsd: number;
  profitUsd: number;
  fobUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  sellingPriceUsd: number;
  priceTerm: PriceTerm;
};

export function calcVehicleCost(params: {
  bidJpy: number;
  markupRate?: number;
  fixedExpenseJpy?: number;
  exchangeRate: number; // e.g. 150 means 150 JPY = 1 USD
  profitUsd?: number;
  freightUsd?: number;
  insuranceUsd?: number;
  priceTerm?: PriceTerm;
}): CostBreakdown {
  const bid = Math.max(0, Number(params.bidJpy) || 0);
  const markupRate = Math.max(0, params.markupRate ?? DEFAULT_MARKUP_RATE);
  const fixed = params.fixedExpenseJpy ?? FIXED_EXPENSE_JPY;
  const rate = Math.max(0.0001, Number(params.exchangeRate) || 150);
  const profit = Math.max(0, Number(params.profitUsd) || 0);
  const freight = Math.max(0, Number(params.freightUsd) || 0);
  const insurance = Math.max(0, Number(params.insuranceUsd) || 0);

  const markupJpy = bid * markupRate;
  const totalCostJpy = bid + markupJpy + fixed;
  const costUsd = totalCostJpy / rate;
  const fobUsd = costUsd + profit;

  let priceTerm: PriceTerm = params.priceTerm || 'FOB';
  if (!params.priceTerm) {
    if (freight > 0 && insurance > 0) priceTerm = 'CIF';
    else if (freight > 0) priceTerm = 'C&F';
    else priceTerm = 'FOB';
  }

  let sellingPriceUsd = fobUsd;
  if (priceTerm === 'C&F' || priceTerm === 'CNF') {
    sellingPriceUsd = fobUsd + freight;
  } else if (priceTerm === 'CIF') {
    sellingPriceUsd = fobUsd + freight + insurance;
  }

  return {
    bidJpy: bid,
    markupRate,
    markupJpy,
    fixedExpenseJpy: fixed,
    totalCostJpy,
    exchangeRate: rate,
    costUsd,
    profitUsd: profit,
    fobUsd,
    freightUsd: freight,
    insuranceUsd: insurance,
    sellingPriceUsd,
    priceTerm,
  };
}

export function formatPricingSummary(b: CostBreakdown): string {
  return [
    `Bid: ¥${b.bidJpy.toLocaleString()}`,
    `+${+(b.markupRate * 100).toFixed(2)}%: ¥${Math.round(b.markupJpy).toLocaleString()}`,
    `Expense: ¥${b.fixedExpenseJpy.toLocaleString()}`,
    `= ¥${Math.round(b.totalCostJpy).toLocaleString()}`,
    `÷ ${b.exchangeRate} = $${b.costUsd.toFixed(2)}`,
    `+ profit $${b.profitUsd.toFixed(2)} = FOB $${b.fobUsd.toFixed(2)}`,
    b.freightUsd > 0 ? `+ freight $${b.freightUsd.toFixed(2)}` : null,
    b.insuranceUsd > 0 ? `+ insurance $${b.insuranceUsd.toFixed(2)}` : null,
    `→ ${b.priceTerm} $${b.sellingPriceUsd.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
