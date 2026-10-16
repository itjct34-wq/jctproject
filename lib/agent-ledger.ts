import { remittanceAllocatedTotal, remittanceAmount, vehicleSoldPrice } from '@/lib/remittance';
import { soldProfitUsd } from '@/lib/vehicle-lifecycle';
import type { Payment, PaymentAllocation, Vehicle } from '@/lib/types';

export type LedgerPayment = Pick<Payment, 'id' | 'amount' | 'remit_amount' | 'sales_agent_id' | 'customer_id' | 'allocation_status' | 'currency'>;
export type LedgerAlloc = Pick<PaymentAllocation, 'payment_id' | 'vehicle_id' | 'allocate_amount'>;
export type LedgerVehicle = Pick<
  Vehicle,
  | 'id'
  | 'stock_number'
  | 'make'
  | 'model'
  | 'sold_price'
  | 'fob_usd'
  | 'listed_price'
  | 'listed_currency'
  | 'shipping_freight_charges'
  | 'commission_pkr'
  | 'commission_status'
  | 'reserved_by'
  | 'customer_id'
  | 'status'
>;

export function paymentTaggedToAgent(
  payment: Pick<Payment, 'sales_agent_id' | 'customer_id'>,
  customerAssignedTo: string | null | undefined,
  agentId: string
): boolean {
  return payment.sales_agent_id === agentId || customerAssignedTo === agentId;
}

export function allocatedToVehicle(allocs: LedgerAlloc[], vehicleId: string): number {
  return allocs
    .filter((a) => a.vehicle_id === vehicleId)
    .reduce((sum, a) => sum + (Number(a.allocate_amount) || 0), 0);
}

export function vehicleBalanceDue(vehicle: LedgerVehicle, allocs: LedgerAlloc[]): number {
  const sold = vehicleSoldPrice(vehicle);
  const paid = allocatedToVehicle(allocs, vehicle.id);
  return Math.max(0, Math.round((sold - paid) * 100) / 100);
}

export function commissionDuePkr(vehicle: LedgerVehicle): number {
  if (vehicle.commission_status === 'due') return Number(vehicle.commission_pkr) || 0;
  return 0;
}

export function commissionPaidPkr(vehicle: LedgerVehicle): number {
  if (vehicle.commission_status === 'paid') return Number(vehicle.commission_pkr) || 0;
  return 0;
}

export function ledgerTotals(payments: LedgerPayment[], allocs: LedgerAlloc[], vehicles: LedgerVehicle[]) {
  const remittanceReceived = payments.reduce((sum, p) => sum + remittanceAmount(p), 0);
  const remittanceAllocated = remittanceAllocatedTotal(allocs);
  const remittanceUnallocated = Math.max(0, Math.round((remittanceReceived - remittanceAllocated) * 100) / 100);
  const totalProfit = vehicles.reduce((sum, v) => sum + (soldProfitUsd(v) ?? 0), 0);
  const commissionsDue = vehicles.reduce((sum, v) => sum + commissionDuePkr(v), 0);
  const commissionsPaid = vehicles.reduce((sum, v) => sum + commissionPaidPkr(v), 0);
  return {
    remittanceReceived,
    remittanceAllocated,
    remittanceUnallocated,
    totalProfit,
    commissionsDue,
    commissionsPaid,
    vehicleCount: vehicles.length,
  };
}
