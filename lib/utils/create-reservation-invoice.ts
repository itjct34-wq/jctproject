import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';

export type ReservationInvoiceInput = {
  customerId: string;
  saleId: string;
  vehicleId: string;
  vehicle?: Vehicle | null;
  salePrice: number;
  currency: string;
  priceTerm: string;
  shipmentType: string;
  containerMode: string;
  portOfDischarge?: string | null;
  freightUsd?: number;
  insuranceUsd?: number;
  dueDate: string;
  createdBy: string;
};

/** Build a multi-line vehicle description for invoice line items. */
export function buildVehicleInvoiceDescription(
  vehicle: Vehicle | null | undefined,
  priceTerm: string
): string {
  const parts = [
    vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle',
    vehicle?.model_year ? `Year: ${vehicle.model_year}` : null,
    vehicle?.chassis_number ? `Chassis: ${vehicle.chassis_number}` : null,
    vehicle?.stock_number ? `Stock: ${vehicle.stock_number}` : null,
    vehicle?.color ? `Color: ${vehicle.color}` : null,
    vehicle?.mileage_km != null
      ? `Mileage: ${Number(vehicle.mileage_km).toLocaleString()} km`
      : null,
    vehicle?.transmission ? `Transmission: ${vehicle.transmission}` : null,
    vehicle?.fuel_type ? `Fuel: ${vehicle.fuel_type}` : null,
    `Terms: ${priceTerm}`,
  ].filter(Boolean);
  return parts.join('\n');
}

/**
 * Creates a proforma invoice + a single invoice_items row linked to the vehicle.
 * Returns { ok, error?, invoiceId? }.
 */
export async function createReservationInvoice(input: ReservationInvoiceInput) {
  const freight = Number(input.freightUsd) || 0;
  const insurance = Number(input.insuranceUsd) || 0;
  const salePrice = Number(input.salePrice) || 0;
  const description = buildVehicleInvoiceDescription(input.vehicle, input.priceTerm);

  const { data: invData, error: invErr } = await supabase
    .from('invoices')
    .insert({
      customer_id: input.customerId,
      sale_id: input.saleId,
      invoice_type: 'proforma',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: input.dueDate,
      subtotal: salePrice,
      tax: 0,
      total: salePrice + freight + insurance,
      currency: input.currency || 'USD',
      payment_status: 'unpaid',
      incoterms: input.priceTerm === 'C&F' ? 'C&F' : input.priceTerm,
      shipment_type: input.shipmentType,
      container_mode: input.containerMode,
      port_of_loading: 'Nagoya, Japan',
      port_of_discharge: input.portOfDischarge || null,
      freight_total: freight,
      insurance_total: insurance,
      notes: `Reservation invoice for ${description.split('\n')[0]}`,
      payment_terms: '100% T/T in advance / LC at sight',
      created_by: input.createdBy,
    })
    .select()
    .maybeSingle();

  if (invErr || !invData) {
    return { ok: false as const, error: invErr?.message || 'Invoice insert failed' };
  }

  const { error: itemErr } = await supabase.from('invoice_items').insert({
    invoice_id: invData.id,
    vehicle_id: input.vehicleId,
    description,
    quantity: 1,
    unit_price: salePrice,
    discount: 0,
    line_total: salePrice,
    sort_order: 0,
  });

  if (itemErr) {
    return {
      ok: false as const,
      error: `Invoice created but vehicle line failed: ${itemErr.message}`,
      invoiceId: invData.id as string,
    };
  }

  return { ok: true as const, invoiceId: invData.id as string };
}
