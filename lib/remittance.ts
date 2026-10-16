import type { Payment, PaymentAllocation, Vehicle } from '@/lib/types';
import { normalizeCurrency } from '@/lib/utils/currencies';

/** Preferred display order when multiple remittance currencies appear. */
export const REMITTANCE_DASHBOARD_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'PKR'] as const;
export type RemittanceDashboardCurrency = (typeof REMITTANCE_DASHBOARD_CURRENCIES)[number];

/** Ring turns from pink/red to green at this allocated %. */
export const REMITTANCE_ALLOCATED_RING_THRESHOLD = 70;

export type RemittanceStatusSlice = {
  unallocated: number;
  partial: number;
  allocated: number;
};

export type RemittanceCurrencyTotals = {
  currency: string;
  remit: number;
  instructed: number;
  allocated: number;
  bankCharges: number;
  unallocated: number;
  /** 0–100, based on allocated / remit. */
  allocatedPct: number;
  /** Remit amounts grouped by allocation status within this currency. */
  status: RemittanceStatusSlice;
};

export function remittanceAmount(p: Pick<Payment, 'amount' | 'remit_amount'>): number {
  return Number(p.remit_amount ?? p.amount) || 0;
}

export function remittanceInstructed(p: Pick<Payment, 'amount' | 'instructed_amount' | 'remit_amount'>): number {
  return Number(p.instructed_amount ?? p.remit_amount ?? p.amount) || 0;
}

export function remittanceAllocatedTotal(allocations: Pick<PaymentAllocation, 'allocate_amount'>[]): number {
  return allocations.reduce((sum, row) => sum + (Number(row.allocate_amount) || 0), 0);
}

export function remittanceRemaining(
  p: Pick<Payment, 'amount' | 'remit_amount'>,
  allocations: Pick<PaymentAllocation, 'allocate_amount'>[]
): number {
  const left = remittanceAmount(p) - remittanceAllocatedTotal(allocations);
  return Math.max(0, Math.round(left * 100) / 100);
}

export function remittanceBankCharges(p: Pick<Payment, 'bank_charges'>): number {
  return Number(p.bank_charges) || 0;
}

/** Derive display status from allocation amounts (DB only stores unallocated|allocated). */
export function remittanceAllocationBucket(
  p: Pick<Payment, 'amount' | 'remit_amount' | 'allocation_status'>,
  allocations: Pick<PaymentAllocation, 'allocate_amount'>[]
): keyof RemittanceStatusSlice {
  const remit = remittanceAmount(p);
  const allocated = remittanceAllocatedTotal(allocations);
  if (remit <= 0) {
    return (p.allocation_status || 'unallocated') === 'allocated' ? 'allocated' : 'unallocated';
  }
  if (allocated <= 0.009) return 'unallocated';
  if (remit - allocated <= 0.009) return 'allocated';
  return 'partial';
}

type AggregatePayment = Pick<
  Payment,
  | 'amount'
  | 'remit_amount'
  | 'instructed_amount'
  | 'bank_charges'
  | 'currency'
  | 'customer_id'
  | 'is_unknown'
  | 'allocation_status'
  | 'status'
> & {
  payment_allocations?: Pick<PaymentAllocation, 'allocate_amount'>[] | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyTotals(currency: string): RemittanceCurrencyTotals {
  return {
    currency,
    remit: 0,
    instructed: 0,
    allocated: 0,
    bankCharges: 0,
    unallocated: 0,
    allocatedPct: 0,
    status: { unallocated: 0, partial: 0, allocated: 0 },
  };
}

function currencySortKey(code: string): number {
  const idx = (REMITTANCE_DASHBOARD_CURRENCIES as readonly string[]).indexOf(code);
  return idx === -1 ? 1000 : idx;
}

/**
 * Group remittance totals by currency for the payments dashboard.
 * Uses remit_amount (fallback amount), instructed_amount, bank_charges, and sum of allocate_amount.
 * Unknown TTs are excluded so sales/inbox noise does not skew allocation %.
 * Only currencies with remittance data are returned (any ISO code found in the rows).
 */
export function aggregateRemittanceByCurrency(payments: AggregatePayment[]): RemittanceCurrencyTotals[] {
  const buckets = new Map<string, RemittanceCurrencyTotals>();

  for (const p of payments) {
    if (isUnknownRemittance(p)) continue;
    if (p.status === 'rejected') continue;
    const code = normalizeCurrency(p.currency);
    if (!buckets.has(code)) buckets.set(code, emptyTotals(code));
    const row = buckets.get(code)!;
    const allocs = p.payment_allocations || [];
    const remit = remittanceAmount(p);
    const allocated = remittanceAllocatedTotal(allocs);
    const bucket = remittanceAllocationBucket(p, allocs);
    row.remit += remit;
    row.instructed += remittanceInstructed(p);
    row.allocated += allocated;
    row.bankCharges += remittanceBankCharges(p);
    row.status[bucket] += remit;
  }

  return Array.from(buckets.values())
    .map((row) => {
      const remit = roundMoney(row.remit);
      const allocated = roundMoney(row.allocated);
      const unallocated = Math.max(0, roundMoney(remit - allocated));
      const allocatedPct = remit > 0 ? Math.round((allocated / remit) * 1000) / 10 : 0;
      return {
        currency: row.currency,
        remit,
        instructed: roundMoney(row.instructed),
        allocated,
        bankCharges: roundMoney(row.bankCharges),
        unallocated,
        allocatedPct,
        status: {
          unallocated: roundMoney(row.status.unallocated),
          partial: roundMoney(row.status.partial),
          allocated: roundMoney(row.status.allocated),
        },
      };
    })
    .filter((row) => row.remit > 0)
    .sort((a, b) => currencySortKey(a.currency) - currencySortKey(b.currency) || a.currency.localeCompare(b.currency));
}

export function vehicleSoldPrice(v: Pick<Vehicle, 'sold_price' | 'fob_usd' | 'listed_price'>): number {
  return Number(v.sold_price ?? v.fob_usd ?? v.listed_price) || 0;
}

export function paymentDisplayId(code: string): string {
  const match = code.match(/(\d+)\s*$/);
  return match ? match[1] : code;
}

/** Unknown TT inbox: no customer tagged yet (or explicit is_unknown flag). */
export function isUnknownRemittance(p: Pick<Payment, 'customer_id' | 'is_unknown'>): boolean {
  if (p.is_unknown === true) return true;
  if (p.is_unknown === false) return false;
  return !p.customer_id;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Prefer remit / received / payment date for analytics windows. */
export function remittanceActivityDate(
  p: Pick<Payment, 'remit_date' | 'received_date' | 'payment_date' | 'created_at'>
): string {
  const raw = p.remit_date || p.received_date || p.payment_date || p.created_at || '';
  const day = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
  return day ? day[1] : '';
}

export function filterRemittancesByDateRange<
  T extends Pick<Payment, 'remit_date' | 'received_date' | 'payment_date' | 'created_at'>,
>(payments: T[], from: string | null | undefined, to: string | null | undefined): T[] {
  const fromDay = from?.trim() || '';
  const toDay = to?.trim() || '';
  if (!fromDay && !toDay) return payments;
  return payments.filter((p) => {
    const day = remittanceActivityDate(p);
    if (!day) return false;
    if (fromDay && day < fromDay) return false;
    if (toDay && day > toDay) return false;
    return true;
  });
}

export type RemittanceOfficeRow = {
  key: string;
  officeId: string | null;
  shiftId: string | null;
  label: string;
  count: number;
  /** Remit totals keyed by currency — only currencies that appear. */
  byCurrency: Record<string, number>;
};

type OfficeAggregatePayment = AggregatePayment &
  Pick<Payment, 'office_id' | 'shift_id' | 'remit_date' | 'received_date' | 'payment_date' | 'created_at'>;

/**
 * Rank offices (and optional shifts) by remittance count.
 * Amounts stay per-currency — never forced into JPY.
 */
export function aggregateRemittanceByOffice(
  payments: OfficeAggregatePayment[],
  labels: {
    offices: Record<string, string>;
    shifts: Record<string, string>;
  }
): RemittanceOfficeRow[] {
  const buckets = new Map<string, RemittanceOfficeRow>();

  for (const p of payments) {
    if (isUnknownRemittance(p)) continue;
    if (p.status === 'rejected') continue;
    const officeId = p.office_id || null;
    const shiftId = p.shift_id || null;
    const key = `${officeId || 'none'}::${shiftId || 'none'}`;
    if (!buckets.has(key)) {
      const officeName = officeId ? labels.offices[officeId] || 'Unknown office' : 'Unassigned office';
      const shiftName = shiftId ? labels.shifts[shiftId] : '';
      buckets.set(key, {
        key,
        officeId,
        shiftId,
        label: shiftName ? `${officeName} · ${shiftName}` : officeName,
        count: 0,
        byCurrency: {},
      });
    }
    const row = buckets.get(key)!;
    const code = normalizeCurrency(p.currency);
    const remit = remittanceAmount(p);
    row.count += 1;
    row.byCurrency[code] = roundMoney((row.byCurrency[code] || 0) + remit);
  }

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Currencies that actually appear across office rows (preferred order first). */
export function currenciesPresentInOfficeRows(rows: RemittanceOfficeRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const [code, total] of Object.entries(row.byCurrency)) {
      if (total > 0) seen.add(code);
    }
  }
  return Array.from(seen).sort(
    (a, b) => currencySortKey(a) - currencySortKey(b) || a.localeCompare(b)
  );
}

/** Remittance count mix by currency (safe for a single pie — no FX conversion). */
export function remittanceCountByCurrency(
  payments: AggregatePayment[]
): Array<{ currency: string; count: number }> {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (isUnknownRemittance(p)) continue;
    if (p.status === 'rejected') continue;
    const code = normalizeCurrency(p.currency);
    map.set(code, (map.get(code) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([currency, count]) => ({ currency, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => currencySortKey(a.currency) - currencySortKey(b.currency) || b.count - a.count);
}
