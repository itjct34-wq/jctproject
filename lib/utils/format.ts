/** Safe number display — never crash on null/undefined */
export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
  opts?: { minimumFractionDigits?: number }
): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const digits = opts?.minimumFractionDigits ?? 0;
  const formatted = safe.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern: 'short' | 'long' | 'iso' = 'short'
): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  if (pattern === 'iso') return d.toISOString().slice(0, 10);
  if (pattern === 'long') {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
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
