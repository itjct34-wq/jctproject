import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';

export type ProcurementSource = 'own_stock' | 'auction' | 'third_party';

export function parseProcurementSource(raw: string | null | undefined): ProcurementSource {
  if (raw === 'auction' || raw === 'third_party' || raw === 'own_stock') return raw;
  return 'own_stock';
}

/** Own-stock lists (Cars/Machinery/Parts) exclude third_party; null/legacy treated as own. */
export function isOwnStockListVehicle(source: string | null | undefined): boolean {
  const p = parseProcurementSource(source);
  return p !== 'third_party';
}

export function isThirdPartyVehicle(source: string | null | undefined): boolean {
  return parseProcurementSource(source) === 'third_party';
}

export type OncePriceFob = {
  purchase_price: number | null;
  purchase_currency: string;
  expense_jpy: number;
  tt_rate: number;
  fob_jpy: number | null;
  fob_usd: number | null;
  listed_price: number | null;
  listed_currency: string;
};

/** Map dealership once-price into purchase/FOB/listed fields for reserve/invoice reuse. */
export function fobFieldsFromOncePrice(
  oncePrice: number,
  currency: string,
  opts?: { expenseJpy?: number; ttRate?: number }
): OncePriceFob {
  const cur = (currency || 'JPY').trim().toUpperCase() || 'JPY';
  const expense = opts?.expenseJpy ?? FIXED_EXPENSE_JPY;
  const tt = opts?.ttRate ?? DEFAULT_TT_RATE;
  const amount = Math.max(0, Number(oncePrice) || 0);

  if (cur === 'USD') {
    return {
      purchase_price: amount,
      purchase_currency: 'USD',
      expense_jpy: expense,
      tt_rate: tt,
      fob_jpy: Math.round(amount * tt),
      fob_usd: Math.round(amount),
      listed_price: Math.round(amount),
      listed_currency: 'USD',
    };
  }

  const fob = calcFobFromBid(amount, expense, tt);
  return {
    purchase_price: amount,
    purchase_currency: 'JPY',
    expense_jpy: expense,
    tt_rate: tt,
    fob_jpy: Math.round(fob.fobJpy),
    fob_usd: Math.round(fob.fobUsd),
    listed_price: Math.round(fob.fobUsd),
    listed_currency: 'USD',
  };
}
