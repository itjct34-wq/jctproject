import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';
import { effectivePaymentStatus } from '@/lib/vehicle-lifecycle';

export type MakeAvailableBlock = {
  kind: 'tt_allocated';
  message: string;
  paymentId: string | null;
  allocateHref: string;
};

export type MakeAvailableResult =
  | { ok: true }
  | { ok: false; error: string; block?: MakeAvailableBlock };

/** Show Make available when the unit still has reservation / commercial hold state. */
export function vehicleCanMakeAvailable(vehicle: Pick<Vehicle, 'payment_status' | 'status' | 'reserved_by' | 'customer_id' | 'sold_price' | 'reserved_until'>) {
  const pay = effectivePaymentStatus(vehicle);
  if (pay !== 'available') return true;
  if (vehicle.reserved_by) return true;
  if (vehicle.customer_id) return true;
  if (vehicle.sold_price != null) return true;
  if (vehicle.reserved_until) return true;
  return false;
}

async function findTtAllocationBlock(vehicleId: string): Promise<MakeAvailableBlock | null> {
  const { data: allocs, error } = await supabase
    .from('payment_allocations')
    .select('id, payment_id, allocate_amount')
    .eq('vehicle_id', vehicleId);
  if (error) throw new Error(error.message);
  const positive = (allocs || []).filter((a) => Number(a.allocate_amount) > 0.009);
  if (positive.length === 0) return null;
  const paymentId = positive[0]?.payment_id || null;
  return {
    kind: 'tt_allocated',
    message: 'Unallocate the remittance / TT first',
    paymentId,
    allocateHref: paymentId ? `/payments/${paymentId}/allocate` : '/payments',
  };
}

async function releaseLinkedInvoices(vehicleId: string): Promise<string | null> {
  const { data: vehicleItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('id, invoice_id, line_total')
    .eq('vehicle_id', vehicleId);
  if (itemsErr) return itemsErr.message;
  if (!vehicleItems?.length) return null;

  const invoiceIds = [...new Set(vehicleItems.map((i) => i.invoice_id).filter(Boolean))];
  for (const invoiceId of invoiceIds) {
    const { data: allItems, error: allErr } = await supabase
      .from('invoice_items')
      .select('id, vehicle_id, line_total')
      .eq('invoice_id', invoiceId);
    if (allErr) return allErr.message;

    const remaining = (allItems || []).filter((row) => row.vehicle_id !== vehicleId);
    if (remaining.length === 0) {
      const { error: delInvErr } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (delInvErr) return delInvErr.message;
      continue;
    }

    const { error: delLineErr } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('vehicle_id', vehicleId);
    if (delLineErr) return delLineErr.message;

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('freight_total, insurance_total, other_charges, discount_total, tax')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invErr) return invErr.message;

    const subtotal = remaining.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0);
    const tax = Number(inv?.tax) || 0;
    const freight = Number(inv?.freight_total) || 0;
    const insurance = Number(inv?.insurance_total) || 0;
    const other = Number(inv?.other_charges) || 0;
    const discount = Number(inv?.discount_total) || 0;
    const total = subtotal + tax + freight + insurance + other - discount;
    const { error: updErr } = await supabase
      .from('invoices')
      .update({ subtotal, total, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);
    if (updErr) return updErr.message;
  }
  return null;
}

/**
 * Admin-only release: block if TT allocations remain, then clear invoices/reservation.
 * Caller must gate with isAdmin() / is_admin_user.
 */
export async function makeVehicleAvailable(opts: {
  vehicle: Pick<Vehicle, 'id' | 'status' | 'stock_number'>;
  actorId: string;
}): Promise<MakeAvailableResult> {
  const vehicleId = opts.vehicle.id;
  let block: MakeAvailableBlock | null = null;
  try {
    block = await findTtAllocationBlock(vehicleId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not check TT allocations' };
  }
  if (block) {
    return { ok: false, error: block.message, block };
  }

  const invoiceErr = await releaseLinkedInvoices(vehicleId);
  if (invoiceErr) return { ok: false, error: `Invoice cleanup failed: ${invoiceErr}` };

  const { error: saleErr } = await supabase
    .from('sales')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .neq('status', 'cancelled');
  if (saleErr) return { ok: false, error: `Could not cancel sale: ${saleErr.message}` };

  const { error: vehicleErr } = await supabase
    .from('vehicles')
    .update({
      payment_status: 'available',
      shipping_status: 'not_booked',
      status: 'in_stock',
      customer_id: null,
      reserved_by: null,
      assigned_agent_id: null,
      reserved_until: null,
      sold_price: null,
      incoterm: null,
      freight_mode: null,
      commission_pkr: null,
      commission_status: 'none',
      shipping_port_of_loading: null,
      shipping_port_of_discharge: null,
      shipping_vessel_name: null,
      shipping_bl_number: null,
      shipping_line: null,
      shipping_etd: null,
      shipping_eta: null,
      shipping_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId);
  if (vehicleErr) return { ok: false, error: vehicleErr.message };

  await supabase.from('vehicle_status_history').insert({
    vehicle_id: vehicleId,
    from_status: opts.vehicle.status,
    to_status: 'in_stock',
    note: `Made available by admin (cleared reservation / invoice for ${opts.vehicle.stock_number})`,
    changed_by: opts.actorId,
  });

  return { ok: true };
}
