import type { Vehicle } from '@/lib/types';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';

export type VehiclePaymentStatus = NonNullable<Vehicle['payment_status']>;
export type VehicleShippingStatus = NonNullable<Vehicle['shipping_status']>;
export type VehicleIncoterm = NonNullable<Vehicle['incoterm']>;
export type VehicleWorkflowStage = 'in_stock' | 'reserved' | 'booked' | 'shipped' | 'delivered';
export type VehicleDocKind = 'bl' | 'surrender' | 'waybill' | 'other';

export const PAYMENT_STATUS_LABELS: Record<VehiclePaymentStatus, string> = {
  available: 'Available',
  reserved: 'Unpaid (reserved)',
  partial_paid: 'Partial paid',
  paid: 'Paid',
};

export const PAYMENT_STATUSES: VehiclePaymentStatus[] = ['available', 'reserved', 'partial_paid', 'paid'];

export const SHIPPING_STATUS_LABELS: Record<VehicleShippingStatus, string> = {
  not_booked: 'Not booked (in stock / reserved)',
  booked: 'Booked',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const SHIPPING_STATUSES: VehicleShippingStatus[] = ['not_booked', 'booked', 'shipped', 'delivered'];

export const WORKFLOW_STAGE_LABELS: Record<VehicleWorkflowStage, string> = {
  in_stock: 'In stock',
  reserved: 'Reserved',
  booked: 'Booked',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const WORKFLOW_STAGES: VehicleWorkflowStage[] = ['in_stock', 'reserved', 'booked', 'shipped', 'delivered'];

export const INCOTERMS: VehicleIncoterm[] = ['FOB', 'C&F', 'CIF'];

export const DOC_KIND_LABELS: Record<VehicleDocKind, string> = {
  bl: 'Bill of lading',
  surrender: 'Surrender',
  waybill: 'Waybill',
  other: 'Other',
};

export const PAYMENT_STATUS_STYLES: Record<VehiclePaymentStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  partial_paid: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const SHIPPING_STATUS_STYLES: Record<VehicleShippingStatus, string> = {
  not_booked: 'bg-slate-50 text-slate-600 border-slate-200',
  booked: 'bg-violet-50 text-violet-700 border-violet-200',
  shipped: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Legacy public listing uses vehicles.status in_stock | reserved */
export function isPubliclyListed(vehicle: Pick<Vehicle, 'status' | 'payment_status'>) {
  return vehicle.status === 'in_stock' || vehicle.status === 'reserved';
}

export function effectivePaymentStatus(vehicle: Vehicle): VehiclePaymentStatus {
  return vehicle.payment_status ?? (vehicle.status === 'in_stock' ? 'available' : vehicle.status === 'reserved' ? 'reserved' : 'paid');
}

export function effectiveShippingStatus(vehicle: Vehicle): VehicleShippingStatus {
  return vehicle.shipping_status ?? 'not_booked';
}

export function publicFobUsd(vehicle: Pick<Vehicle, 'fob_usd' | 'listed_price'>): number | null {
  if (vehicle.fob_usd != null) return Number(vehicle.fob_usd);
  if (vehicle.listed_price != null) return Number(vehicle.listed_price);
  return null;
}

export function workflowStage(vehicle: Vehicle): VehicleWorkflowStage {
  const ship = effectiveShippingStatus(vehicle);
  const pay = effectivePaymentStatus(vehicle);
  if (ship === 'delivered') return 'delivered';
  if (ship === 'shipped') return 'shipped';
  if (ship === 'booked') return 'booked';
  if (pay !== 'available' || vehicle.customer_id) return 'reserved';
  return 'in_stock';
}

export function fobPreviewFromForm(bid: string, expense: string, tt: string) {
  return calcFobFromBid(
    Number(bid) || 0,
    expense === '' ? FIXED_EXPENSE_JPY : Number(expense) || 0,
    tt === '' ? DEFAULT_TT_RATE : Number(tt) || DEFAULT_TT_RATE
  );
}

export const emptyShippingForm = {
  shipping_port_of_loading: '',
  shipping_port_of_discharge: '',
  shipping_vessel_name: '',
  shipping_bl_number: '',
  shipping_line: '',
  shipping_etd: '',
  shipping_eta: '',
  shipping_notes: '',
};
