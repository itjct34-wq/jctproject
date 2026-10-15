import type { Payment, PaymentAllocation, Vehicle } from '@/lib/types';

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

export function vehicleSoldPrice(v: Pick<Vehicle, 'sold_price' | 'fob_usd' | 'listed_price'>): number {
  return Number(v.sold_price ?? v.fob_usd ?? v.listed_price) || 0;
}

export function paymentDisplayId(code: string): string {
  const match = code.match(/(\d+)\s*$/);
  return match ? match[1] : code;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
