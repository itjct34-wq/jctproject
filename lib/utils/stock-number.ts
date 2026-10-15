const STOCK_RE = /^JCT-V-(\d+)$/i;

/** Next ERP stock code (JCT-V-1001+) from existing inventory, without consuming the DB sequence. */
export function nextVehicleStockNumber(existing: Array<string | null | undefined>): string {
  const used = new Set(
    existing
      .map((s) => (s || '').trim().toUpperCase())
      .filter(Boolean)
  );
  let max = 1000;
  for (const code of used) {
    const match = STOCK_RE.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  let n = max + 1;
  let next = `JCT-V-${n}`;
  while (used.has(next.toUpperCase())) {
    n += 1;
    next = `JCT-V-${n}`;
  }
  return next;
}
