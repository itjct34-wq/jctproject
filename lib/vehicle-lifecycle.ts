import type { Vehicle } from '@/lib/types';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';

export type VehiclePaymentStatus = NonNullable<Vehicle['payment_status']>;
export type VehicleShippingStatus = NonNullable<Vehicle['shipping_status']>;
export type VehicleIncoterm = NonNullable<Vehicle['incoterm']>;
export type VehicleFreightMode = NonNullable<Vehicle['freight_mode']>;
export type VehicleCommissionStatus = NonNullable<Vehicle['commission_status']>;
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

export const FREIGHT_MODES: VehicleFreightMode[] = ['roro', 'container'];

export const FREIGHT_MODE_LABELS: Record<VehicleFreightMode, string> = {
  roro: 'RORO',
  container: 'Container',
};

export const COMMISSION_STATUSES: VehicleCommissionStatus[] = ['none', 'due', 'paid'];

export const COMMISSION_STATUS_LABELS: Record<VehicleCommissionStatus, string> = {
  none: 'None',
  due: 'Due',
  paid: 'Paid',
};

export function effectiveCommissionStatus(vehicle: Pick<Vehicle, 'commission_status'>): VehicleCommissionStatus {
  return vehicle.commission_status === 'due' || vehicle.commission_status === 'paid' ? vehicle.commission_status : 'none';
}

export function commissionAmountPkr(vehicle: Pick<Vehicle, 'commission_pkr'>): number | null {
  if (vehicle.commission_pkr == null) return null;
  const n = Number(vehicle.commission_pkr);
  return Number.isFinite(n) ? n : null;
}

/** Optional config helper. Returns null unless a positive PKR-per-USD rate is stored. Never invents a rate. */
export function parsePkrPerUsd(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const inner = rec.pkr_per_usd ?? rec.value ?? rec.rate ?? rec.amount;
    return parsePkrPerUsd(inner);
  }
  return null;
}

export function suggestCommissionPkr(profitUsd: number | null | undefined, pkrPerUsd: number | null, percent: number): number | null {
  if (profitUsd == null || pkrPerUsd == null || pkrPerUsd <= 0) return null;
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(Number(profitUsd) * pkrPerUsd * (pct / 100));
}

export function parseFreightMode(value: string | null | undefined): VehicleFreightMode | null {
  if (value === 'roro' || value === 'container') return value;
  if (!value) return null;
  const n = value.trim().toLowerCase();
  if (n === 'roro') return 'roro';
  if (n.includes('container') || n.includes('20ft') || n.includes('40ft') || n === '20ft' || n === '40ft') return 'container';
  return null;
}

export function freightModeFromShipmentType(shipmentType: string | null | undefined): VehicleFreightMode | null {
  return parseFreightMode(shipmentType);
}

export function soldProfitUsd(vehicle: Pick<Vehicle, 'sold_price' | 'fob_usd' | 'listed_price'>): number | null {
  if (vehicle.sold_price == null) return null;
  const fob = publicFobUsd(vehicle);
  if (fob == null) return null;
  return Number(vehicle.sold_price) - Number(fob);
}

export const DOC_KIND_LABELS: Record<VehicleDocKind, string> = {
  bl: 'Bill of lading',
  surrender: 'Surrender',
  waybill: 'Waybill',
  other: 'Other',
};

export const PAYMENT_STATUS_STYLES: Record<VehiclePaymentStatus, string> = {
  available: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  reserved: 'bg-sky-50 text-sky-800 border-sky-200',
  partial_paid: 'bg-amber-50 text-amber-900 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-900 border-emerald-300',
};

/** Large right-rail pills on the ERP stock list (screenshot labels). */
export const PAYMENT_STATUS_PILL_LABELS: Record<VehiclePaymentStatus, string> = {
  available: 'AVAILABLE',
  reserved: 'RESERVED',
  partial_paid: 'PARTIAL PAID',
  paid: 'PAID',
};

export const PAYMENT_STATUS_PILL_STYLES: Record<VehiclePaymentStatus, string> = {
  available: 'bg-emerald-600 text-white',
  reserved: 'bg-sky-600 text-white',
  partial_paid: 'bg-amber-500 text-white',
  paid: 'bg-emerald-600 text-white',
};

export const SHIPPING_STATUS_STYLES: Record<VehicleShippingStatus, string> = {
  not_booked: 'bg-slate-50 text-slate-700 border-slate-200',
  booked: 'bg-sky-50 text-sky-800 border-sky-200',
  shipped: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  delivered: 'bg-slate-200 text-slate-800 border-slate-300',
};

export const SHIPPING_STATUS_SHORT: Record<VehicleShippingStatus, string> = {
  not_booked: 'NOT BOOKED',
  booked: 'BOOKED',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
};

/** Screenshot freight wording. Empty when freight_mode is unset. */
export function freightModeListLabel(mode: Vehicle['freight_mode'] | '' | undefined): string {
  if (mode === 'roro') return 'RORO';
  if (mode === 'container') return '40 Feet Container';
  return '';
}

/** Full-row ERP list tint from payment_status (shipping stays in the right rail). */
export function vehicleListRowClass(vehicle: Vehicle): string {
  const pay = effectivePaymentStatus(vehicle);
  if (pay === 'paid') return 'border-emerald-300/80 bg-emerald-100/90 text-emerald-950';
  if (pay === 'partial_paid') return 'border-amber-300/80 bg-amber-100/80 text-amber-950';
  if (pay === 'reserved') return 'border-sky-300/80 bg-sky-100/90 text-sky-950';
  return 'border-emerald-200/70 bg-white text-emerald-950';
}

/** Extra list cue when the vehicle is paid/delivered but commission is still due. */
export function vehicleCommissionDueClass(vehicle: Pick<Vehicle, 'commission_status'>): string {
  return effectiveCommissionStatus(vehicle) === 'due' ? 'ring-1 ring-inset ring-fuchsia-400' : '';
}

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
