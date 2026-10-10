/** Supported trading currencies across the ERP */
export const SUPPORTED_CURRENCIES = ['USD', 'JPY', 'PKR', 'EUR', 'GBP'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: 'US Dollar',
  JPY: 'Japanese Yen',
  PKR: 'Pakistani Rupee',
  EUR: 'Euro',
  GBP: 'British Pound',
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  JPY: '¥',
  PKR: 'Rs',
  EUR: '€',
  GBP: '£',
};

/** Default display decimals per currency */
export const CURRENCY_DECIMALS: Record<SupportedCurrency, number> = {
  USD: 2,
  JPY: 0,
  PKR: 0,
  EUR: 2,
  GBP: 2,
};

export function isSupportedCurrency(c: string | null | undefined): c is SupportedCurrency {
  return !!c && (SUPPORTED_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}

export function normalizeCurrency(c: string | null | undefined, fallback: SupportedCurrency = 'USD'): SupportedCurrency {
  if (!c) return fallback;
  const u = c.toUpperCase();
  return isSupportedCurrency(u) ? u : fallback;
}

/** Format money with proper decimals for the currency */
export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined = 'USD',
  opts?: { showCode?: boolean; showSymbol?: boolean }
): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const code = normalizeCurrency(currency);
  const digits = CURRENCY_DECIMALS[code];
  const formatted = safe.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (opts?.showSymbol) return `${CURRENCY_SYMBOLS[code]}${formatted}`;
  if (opts?.showCode === false) return formatted;
  return `${code} ${formatted}`;
}
