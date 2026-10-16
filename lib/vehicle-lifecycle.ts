import type { Vehicle } from '@/lib/types';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';

export type VehiclePaymentStatus = NonNullable<Vehicle['payment_status']>;
export type VehicleShippingStatus = NonNullable<Vehicle['shipping_status']>;
export type VehicleIncoterm = NonNullable<Vehicle['incoterm']>;
export type VehicleFreightMode = NonNullable<Vehicle['freight_mode']>;
export type VehicleCommissionStatus = NonNullable<Vehicle['commission_status']>;
export type VehicleWorkflowStage = 'in_stock' | 'reserved' | 'booked' | 'shipped' | 'delivered';
export type VehicleDocKind =
  | 'bl'
  | 'amend_bl'
  | 'surrender'
  | 'draft'
  | 'waybill'
  | 'shipping_invoice'
  | 'export_certificate'
  | 'export_certificate_en'
  | 'inspection'
  | 'auction_sheet'
  | 'spare_key'
  | 'dhl'
  | 'other';

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
  amend_bl: 'Amend BL',
  surrender: 'Surrender',
  draft: 'Draft',
  waybill: 'Waybill',
  shipping_invoice: 'Shipping invoice',
  export_certificate: 'Export Certificate - 輸出証明書',
  export_certificate_en: 'Export Certificate (English version) - 輸出証明書 (英語版)',
  inspection: 'Inspection certificate',
  auction_sheet: 'Auction sheet',
  spare_key: 'Spare key',
  dhl: 'DHL documents',
  other: 'Other documents',
};

export const COURIER_SELECTION_OPTIONS = [
  'DHL',
  'EMS',
  'FedEx',
  'Japan Post',
  'UPS',
  'Other',
] as const;

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
  available: 'bg-white text-slate-950 border border-slate-900',
  reserved: 'bg-sky-600 text-white',
  partial_paid: 'bg-amber-500 text-white',
  paid: 'bg-green-700 text-white',
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
  if (pay === 'paid') return 'border-2 border-green-600 bg-green-300 text-green-950';
  if (pay === 'partial_paid') return 'border-2 border-amber-500 bg-amber-200 text-amber-950';
  if (pay === 'reserved') return 'border-2 border-sky-500 bg-sky-200 text-sky-950';
  return 'border-2 border-emerald-300 bg-white text-emerald-950';
}

/** Extra list cue when the vehicle is paid/delivered but commission is still due. */
export function vehicleCommissionDueClass(vehicle: Pick<Vehicle, 'commission_status'>): string {
  return effectiveCommissionStatus(vehicle) === 'due' ? 'ring-1 ring-inset ring-fuchsia-400' : '';
}

/** Legacy public listing uses vehicles.status in_stock | reserved */
export function isPubliclyListed(vehicle: Pick<Vehicle, 'status' | 'payment_status'>) {
  return vehicle.status === 'in_stock' || vehicle.status === 'reserved';
}

export function effectivePaymentStatus(
  vehicle: Pick<Vehicle, 'payment_status' | 'status'>
): VehiclePaymentStatus {
  return vehicle.payment_status ?? (vehicle.status === 'in_stock' ? 'available' : vehicle.status === 'reserved' ? 'reserved' : 'paid');
}

/** Display name for toast when a unit is already held. */
export function reservationHolderLabel(
  reservedBy: string | null | undefined,
  agentNames?: Record<string, string>
): string {
  if (!reservedBy) return 'another agent';
  const named = agentNames?.[reservedBy]?.trim();
  return named || 'another agent';
}

/**
 * One vehicle may only be reserved by one agent at a time.
 * Returns a toast message when a new reserve action should be blocked; null when free to claim.
 */
export function reservationExclusivityMessage(
  vehicle: Pick<Vehicle, 'payment_status' | 'reserved_by' | 'status'>,
  actorId: string | null | undefined,
  agentNames?: Record<string, string>
): string | null {
  const pay = effectivePaymentStatus(vehicle);
  const holderId = vehicle.reserved_by ?? null;
  const takenByPayment = pay === 'reserved' || pay === 'partial_paid' || pay === 'paid';
  const takenByOther = Boolean(holderId && (!actorId || holderId !== actorId));
  if (takenByPayment || takenByOther) {
    return `Already reserved by ${reservationHolderLabel(holderId, agentNames)}`;
  }
  return null;
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
  shipping_line: '',
  shipping_vessel_name: '',
  shipping_voyage_number: '',
  shipping_etd: '',
  shipping_eta: '',
  shipping_port_of_loading: '',
  shipping_place_of_delivery: '',
  shipping_port_of_discharge: '',
  shipping_forwarding_agent: '',
  shipping_cut_off_date: '',
  shipping_bl_number: '',
  shipping_booking_number: '',
  shipping_track_url: '',
  shipping_bl_date: '',
  freight_mode: '' as '' | VehicleFreightMode,
  shipping_container_number: '',
  shipping_freight_charges: '',
  shipping_vanning_charges: '',
  shipping_notes: '',
};

export const emptyCourierForm = {
  courier_selection: '',
  courier_company: '',
  courier_tracking_id: '',
  courier_date: '',
  courier_details: '',
  courier_charges: '',
};

export function shippingFormFromVehicle(v: Vehicle): typeof emptyShippingForm {
  return {
    shipping_line: v.shipping_line || '',
    shipping_vessel_name: v.shipping_vessel_name || '',
    shipping_voyage_number: v.shipping_voyage_number || '',
    shipping_etd: v.shipping_etd || '',
    shipping_eta: v.shipping_eta || '',
    shipping_port_of_loading: v.shipping_port_of_loading || '',
    shipping_place_of_delivery: v.shipping_place_of_delivery || v.shipping_port_of_discharge || '',
    shipping_port_of_discharge: v.shipping_port_of_discharge || '',
    shipping_forwarding_agent: v.shipping_forwarding_agent || '',
    shipping_cut_off_date: v.shipping_cut_off_date || '',
    shipping_bl_number: v.shipping_bl_number || '',
    shipping_booking_number: v.shipping_booking_number || '',
    shipping_track_url: v.shipping_track_url || '',
    shipping_bl_date: v.shipping_bl_date || '',
    freight_mode: v.freight_mode === 'roro' || v.freight_mode === 'container' ? v.freight_mode : '',
    shipping_container_number: v.shipping_container_number || '',
    shipping_freight_charges: v.shipping_freight_charges != null ? String(v.shipping_freight_charges) : '',
    shipping_vanning_charges: v.shipping_vanning_charges != null ? String(v.shipping_vanning_charges) : '',
    shipping_notes: v.shipping_notes || '',
  };
}

export function courierFormFromVehicle(v: Vehicle): typeof emptyCourierForm {
  return {
    courier_selection: v.courier_selection || '',
    courier_company: v.courier_company || '',
    courier_tracking_id: v.courier_tracking_id || '',
    courier_date: v.courier_date || '',
    courier_details: v.courier_details || '',
    courier_charges: v.courier_charges != null ? String(v.courier_charges) : '',
  };
}

export function shippingPayloadFromForm(form: typeof emptyShippingForm) {
  const place = form.shipping_place_of_delivery.trim() || null;
  return {
    shipping_line: form.shipping_line.trim() || null,
    shipping_vessel_name: form.shipping_vessel_name.trim() || null,
    shipping_voyage_number: form.shipping_voyage_number.trim() || null,
    shipping_etd: form.shipping_etd || null,
    shipping_eta: form.shipping_eta || null,
    shipping_port_of_loading: form.shipping_port_of_loading.trim() || null,
    shipping_place_of_delivery: place,
    shipping_port_of_discharge: place || form.shipping_port_of_discharge.trim() || null,
    shipping_forwarding_agent: form.shipping_forwarding_agent.trim() || null,
    shipping_cut_off_date: form.shipping_cut_off_date || null,
    shipping_bl_number: form.shipping_bl_number.trim() || null,
    shipping_booking_number: form.shipping_booking_number.trim() || null,
    shipping_track_url: form.shipping_track_url.trim() || null,
    shipping_bl_date: form.shipping_bl_date || null,
    freight_mode: form.freight_mode === 'roro' || form.freight_mode === 'container' ? form.freight_mode : null,
    shipping_container_number: form.shipping_container_number.trim() || null,
    shipping_freight_charges: form.shipping_freight_charges === '' ? null : Number(form.shipping_freight_charges) || 0,
    shipping_vanning_charges: form.shipping_vanning_charges === '' ? null : Number(form.shipping_vanning_charges) || 0,
    shipping_notes: form.shipping_notes.trim() || null,
  };
}

export function courierPayloadFromForm(form: typeof emptyCourierForm) {
  return {
    courier_selection: form.courier_selection.trim() || null,
    courier_company: form.courier_company.trim() || null,
    courier_tracking_id: form.courier_tracking_id.trim() || null,
    courier_date: form.courier_date || null,
    courier_details: form.courier_details.trim() || null,
    courier_charges: form.courier_charges === '' ? null : Number(form.courier_charges) || 0,
  };
}
