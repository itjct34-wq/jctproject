import { formatCurrency, normalizeCurrency } from '@/lib/utils/currencies';

/** Safe number display. When currency is set, uses USD/JPY/PKR/EUR/GBP rules. */
export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
  opts?: { minimumFractionDigits?: number }
): string {
  if (currency) return formatCurrency(value, currency);
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const digits = opts?.minimumFractionDigits ?? 0;
  return safe.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  });
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern: 'short' | 'long' | 'iso' = 'short'
): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  if (pattern === 'iso') return d.toISOString().slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function sumByCurrency(
  rows: Array<{ amount: number; currency?: string | null }>
): Array<{ currency: string; total: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const code = normalizeCurrency(row.currency);
    map.set(code, (map.get(code) || 0) + (Number(row.amount) || 0));
  }
  return Array.from(map.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}
