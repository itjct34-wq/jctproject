import type { Vehicle } from '@/lib/types';

export type VehiclePaymentStatus = NonNullable<Vehicle['payment_status']>;
export type VehicleShippingStatus = NonNullable<Vehicle['shipping_status']>;

export const PAYMENT_STATUS_LABELS: Record<VehiclePaymentStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  partial_paid: 'Partial paid',
  paid: 'Paid',
};

export const SHIPPING_STATUS_LABELS: Record<VehicleShippingStatus, string> = {
  not_booked: 'Not booked',
  booked: 'Booked',
  shipped: 'Shipped',
  delivered: 'Delivered',
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

export const emptyShippingForm = {
  shipping_status: 'not_booked' as VehicleShippingStatus,
  shipping_port_of_loading: '',
  shipping_port_of_discharge: '',
  shipping_vessel_name: '',
  shipping_bl_number: '',
  shipping_line: '',
  shipping_etd: '',
  shipping_eta: '',
  shipping_notes: '',
};
