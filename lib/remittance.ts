import type { Payment, PaymentAllocation, Vehicle } from '@/lib/types';
import { normalizeCurrency } from '@/lib/utils/currencies';

/** Currencies shown on the remittances allocation dashboard. */
export const REMITTANCE_DASHBOARD_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP'] as const;
export type RemittanceDashboardCurrency = (typeof REMITTANCE_DASHBOARD_CURRENCIES)[number];

/** Ring turns from pink/red to green at this allocated %. */
export const REMITTANCE_ALLOCATED_RING_THRESHOLD = 70;

export type RemittanceCurrencyTotals = {
  currency: RemittanceDashboardCurrency;
  remit: number;
  instructed: number;
  allocated: number;
  bankCharges: number;
  unallocated: number;
  /** 0–100, based on allocated / remit. */
  allocatedPct: number;
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

type AggregatePayment = Pick<
  Payment,
  'amount' | 'remit_amount' | 'instructed_amount' | 'bank_charges' | 'currency' | 'customer_id' | 'is_unknown'
> & {
  payment_allocations?: Pick<PaymentAllocation, 'allocate_amount'>[] | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Group remittance totals by currency for the payments dashboard.
 * Uses remit_amount (fallback amount), instructed_amount, bank_charges, and sum of allocate_amount.
 * Unknown TTs are excluded so sales/inbox noise does not skew allocation %.
 */
export function aggregateRemittanceByCurrency(
  payments: AggregatePayment[],
  currencies: readonly RemittanceDashboardCurrency[] = REMITTANCE_DASHBOARD_CURRENCIES
): RemittanceCurrencyTotals[] {
  const buckets = new Map<RemittanceDashboardCurrency, RemittanceCurrencyTotals>();
  for (const code of currencies) {
    buckets.set(code, {
      currency: code,
      remit: 0,
      instructed: 0,
      allocated: 0,
      bankCharges: 0,
      unallocated: 0,
      allocatedPct: 0,
    });
  }

  for (const p of payments) {
    if (isUnknownRemittance(p)) continue;
    const code = normalizeCurrency(p.currency);
    if (!buckets.has(code as RemittanceDashboardCurrency)) continue;
    const row = buckets.get(code as RemittanceDashboardCurrency)!;
    const remit = remittanceAmount(p);
    const allocated = remittanceAllocatedTotal(p.payment_allocations || []);
    row.remit += remit;
    row.instructed += remittanceInstructed(p);
    row.allocated += allocated;
    row.bankCharges += remittanceBankCharges(p);
  }

  return currencies.map((code) => {
    const row = buckets.get(code)!;
    const remit = roundMoney(row.remit);
    const allocated = roundMoney(row.allocated);
    const unallocated = Math.max(0, roundMoney(remit - allocated));
    const allocatedPct = remit > 0 ? Math.round((allocated / remit) * 1000) / 10 : 0;
    return {
      currency: code,
      remit,
      instructed: roundMoney(row.instructed),
      allocated,
      bankCharges: roundMoney(row.bankCharges),
      unallocated,
      allocatedPct,
    };
  });
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
