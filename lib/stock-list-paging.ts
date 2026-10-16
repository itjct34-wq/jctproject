export const STOCK_PAGE_SIZES = [10, 25, 50, 100, 250] as const;
export type StockPageSize = (typeof STOCK_PAGE_SIZES)[number];

export const DEFAULT_STOCK_PAGE_SIZE: StockPageSize = 10;

export function parseStockPageSize(raw: string | null | undefined): StockPageSize {
  const n = Number(raw);
  return (STOCK_PAGE_SIZES as readonly number[]).includes(n) ? (n as StockPageSize) : DEFAULT_STOCK_PAGE_SIZE;
}

export function parseStockPage(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Compact page list: 1 2 3 4 5 … last (or with middle ellipsis). */
export function stockPageItems(current: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
    pages.add(5);
  }
  if (current >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
    pages.add(totalPages - 4);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

export function clampStockPage(page: number, total: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize) || 1);
  return Math.min(Math.max(1, page), totalPages);
}
