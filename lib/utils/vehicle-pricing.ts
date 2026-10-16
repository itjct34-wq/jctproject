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
export const DEFAULT_TT_RATE = 155; // JPY per 1 USD
export const BID_MARKUP_RATE = 0.1;

export type FobFromBid = {
  bidJpy: number;
  markupJpy: number;
  expenseJpy: number;
  fobJpy: number;
  ttRate: number;
  fobUsd: number;
};

/** Live trading FOB: bid + 10% + expense_jpy, then ÷ TT (JPY per 1 USD). */
export function calcFobFromBid(bidJpy: number, expenseJpy = FIXED_EXPENSE_JPY, ttRate = DEFAULT_TT_RATE): FobFromBid {
  const bid = Math.max(0, Number(bidJpy) || 0);
  const expense = Math.max(0, Number(expenseJpy) || 0);
  const tt = Math.max(0.0001, Number(ttRate) || DEFAULT_TT_RATE);
  const markupJpy = bid * BID_MARKUP_RATE;
  const fobJpy = bid + markupJpy + expense;
  // Round FOB USD for display/storage — keep JPY side precise until ÷ TT.
  return { bidJpy: bid, markupJpy, expenseJpy: expense, fobJpy, ttRate: tt, fobUsd: Math.round(fobJpy / tt) };
}

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
  const costUsd = Math.round(totalCostJpy / rate);
  const fobUsd = Math.round(costUsd + profit);

  let priceTerm: PriceTerm = params.priceTerm || 'FOB';
  if (!params.priceTerm) {
    if (freight > 0 && insurance > 0) priceTerm = 'CIF';
    else if (freight > 0) priceTerm = 'C&F';
    else priceTerm = 'FOB';
  }

  let sellingPriceUsd = fobUsd;
  if (priceTerm === 'C&F' || priceTerm === 'CNF') {
    sellingPriceUsd = Math.round(fobUsd + freight);
  } else if (priceTerm === 'CIF') {
    sellingPriceUsd = Math.round(fobUsd + freight + insurance);
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
    `÷ ${b.exchangeRate} = $${Math.round(b.costUsd).toLocaleString()}`,
    `+ profit $${Math.round(b.profitUsd).toLocaleString()} = FOB $${Math.round(b.fobUsd).toLocaleString()}`,
    b.freightUsd > 0 ? `+ freight $${Math.round(b.freightUsd).toLocaleString()}` : null,
    b.insuranceUsd > 0 ? `+ insurance $${Math.round(b.insuranceUsd).toLocaleString()}` : null,
    `→ ${b.priceTerm} $${Math.round(b.sellingPriceUsd).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
