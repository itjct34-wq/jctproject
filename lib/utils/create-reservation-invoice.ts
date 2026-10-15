import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';

export type ReservationParty = {
  name: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type ReservationCharges = {
  service?: number;
  freight?: number;
  vanning?: number;
  inspection?: number;
  insurance?: number;
  trailer?: number;
  inland?: number;
  clearing?: number;
  courier?: number;
  other?: number;
};

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
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  destinationCountry?: string | null;
  freightUsd?: number;
  insuranceUsd?: number;
  otherChargesUsd?: number;
  discountUsd?: number;
  charges?: ReservationCharges;
  consignee?: ReservationParty | null;
  notifyParty?: ReservationParty | null;
  issueDate?: string;
  dueDate: string;
  paymentDueDate?: string | null;
  paymentTerms?: string | null;
  remarks?: string | null;
  emailInvoice?: boolean;
  salesAgentName?: string | null;
  createdBy: string;
  invoiceType?: 'proforma' | 'commercial';
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

function chargesNotes(charges?: ReservationCharges): string | null {
  if (!charges) return null;
  const lines = [
    charges.service ? `Service: ${charges.service}` : null,
    charges.freight ? `Freight: ${charges.freight}` : null,
    charges.vanning ? `Vanning: ${charges.vanning}` : null,
    charges.inspection ? `Inspection: ${charges.inspection}` : null,
    charges.insurance ? `Insurance: ${charges.insurance}` : null,
    charges.trailer ? `Trailer: ${charges.trailer}` : null,
    charges.inland ? `Inland: ${charges.inland}` : null,
    charges.clearing ? `Clearing: ${charges.clearing}` : null,
    charges.courier ? `Courier: ${charges.courier}` : null,
    charges.other ? `Other: ${charges.other}` : null,
  ].filter(Boolean);
  return lines.length ? lines.join(' · ') : null;
}

/**
 * Creates a reservation invoice + vehicle invoice_items row.
 * Returns { ok, error?, invoiceId? }.
 */
export async function createReservationInvoice(input: ReservationInvoiceInput) {
  const freight = Number(input.freightUsd) || Number(input.charges?.freight) || 0;
  const insurance = Number(input.insuranceUsd) || Number(input.charges?.insurance) || 0;
  const salePrice = Number(input.salePrice) || 0;
  const discount = Number(input.discountUsd) || 0;
  const otherFromCharges =
    (Number(input.charges?.service) || 0) +
    (Number(input.charges?.vanning) || 0) +
    (Number(input.charges?.inspection) || 0) +
    (Number(input.charges?.trailer) || 0) +
    (Number(input.charges?.inland) || 0) +
    (Number(input.charges?.clearing) || 0) +
    (Number(input.charges?.courier) || 0) +
    (Number(input.charges?.other) || 0);
  const otherCharges = Number(input.otherChargesUsd) || otherFromCharges;
  const description = buildVehicleInvoiceDescription(input.vehicle, input.priceTerm);
  const chargeNote = chargesNotes(input.charges);
  const consignee = input.consignee;
  const notify = input.notifyParty;
  const issueDate = input.issueDate || new Date().toISOString().split('T')[0];
  const total = Math.max(0, salePrice + freight + insurance + otherCharges - discount);

  const notesParts = [
    input.remarks?.trim() || null,
    `Reservation invoice for ${description.split('\n')[0]}`,
    consignee?.name ? `Consignee: ${consignee.name}` : null,
  ].filter(Boolean);

  const { data: invData, error: invErr } = await supabase
    .from('invoices')
    .insert({
      customer_id: input.customerId,
      sale_id: input.saleId,
      invoice_type: input.invoiceType || 'commercial',
      issue_date: issueDate,
      due_date: input.dueDate,
      payment_due_date: input.paymentDueDate || input.dueDate,
      subtotal: salePrice,
      tax: 0,
      total,
      currency: input.currency || 'USD',
      payment_status: 'unpaid',
      incoterms: input.priceTerm === 'CNF' ? 'C&F' : input.priceTerm,
      shipment_type: input.shipmentType,
      container_mode: input.containerMode,
      port_of_loading: input.portOfLoading || 'Nagoya, Japan',
      port_of_discharge: input.portOfDischarge || null,
      destination_country: input.destinationCountry || null,
      freight_total: freight,
      freight_notes: chargeNote,
      insurance_total: insurance,
      other_charges: otherCharges,
      discount_total: discount,
      notes: notesParts.join('\n'),
      payment_terms: input.paymentTerms || '100% T/T in advance',
      sales_agent_name: input.salesAgentName || null,
      email_invoice: Boolean(input.emailInvoice),
      consignee_name: consignee?.name || null,
      consignee_country: consignee?.country || null,
      consignee_city: consignee?.city || null,
      consignee_address: consignee?.address || null,
      consignee_phone: consignee?.phone || null,
      consignee_email: consignee?.email || null,
      notify_party_name: notify?.name || null,
      notify_party_country: notify?.country || null,
      notify_party_city: notify?.city || null,
      notify_party_address: notify?.address || null,
      notify_party_phone: notify?.phone || null,
      notify_party_email: notify?.email || null,
      created_by: input.createdBy,
    })
    .select()
    .maybeSingle();

  if (invErr || !invData) {
    return { ok: false as const, error: invErr?.message || 'Invoice insert failed' };
  }

  const lineItems: Array<{
    invoice_id: string;
    vehicle_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
    sort_order: number;
  }> = [
    {
      invoice_id: invData.id,
      vehicle_id: input.vehicleId,
      description,
      quantity: 1,
      unit_price: salePrice,
      discount: 0,
      line_total: salePrice,
      sort_order: 0,
    },
  ];

  if (freight > 0) {
    lineItems.push({
      invoice_id: invData.id,
      vehicle_id: null,
      description: 'Ocean freight',
      quantity: 1,
      unit_price: freight,
      discount: 0,
      line_total: freight,
      sort_order: 1,
    });
  }
  if (insurance > 0) {
    lineItems.push({
      invoice_id: invData.id,
      vehicle_id: null,
      description: 'Insurance',
      quantity: 1,
      unit_price: insurance,
      discount: 0,
      line_total: insurance,
      sort_order: 2,
    });
  }
  if (otherCharges > 0) {
    lineItems.push({
      invoice_id: invData.id,
      vehicle_id: null,
      description: chargeNote || 'Other charges',
      quantity: 1,
      unit_price: otherCharges,
      discount: 0,
      line_total: otherCharges,
      sort_order: 3,
    });
  }

  const { error: itemErr } = await supabase.from('invoice_items').insert(lineItems);

  if (itemErr) {
    return {
      ok: false as const,
      error: `Invoice created but line items failed: ${itemErr.message}`,
      invoiceId: invData.id as string,
    };
  }

  return { ok: true as const, invoiceId: invData.id as string };
}
