import { resolveSourceCountryFromRow } from '@/lib/source-countries';
import { normalizeChassis } from '@/lib/utils/chassis';
import { parseOptionalNumber, splitImageUrls } from '@/lib/utils/csv-import';
import type { SupabaseClient } from '@supabase/supabase-js';

const TRANSMISSIONS = new Set(['automatic', 'manual', 'cvt', 'other']);
const FUELS = new Set(['petrol', 'diesel', 'hybrid', 'electric', 'other']);
const STATUSES = new Set(['in_stock', 'reserved', 'sold', 'in_transit', 'exported', 'on_hold', 'archived']);

function mapTransmission(raw: string): string | null | 'invalid' {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (TRANSMISSIONS.has(v)) return v;
  if (['at', 'auto', 'a/t'].includes(v)) return 'automatic';
  if (['mt', 'manual', 'm/t', 'stick'].includes(v)) return 'manual';
  return 'invalid';
}

function mapFuel(raw: string): string | null | 'invalid' {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (FUELS.has(v)) return v;
  if (['gasoline', 'gas', 'ice', 'unleaded'].includes(v)) return 'petrol';
  if (['hv', 'hev', 'phv', 'phev'].includes(v)) return 'hybrid';
  if (['ev', 'bev'].includes(v)) return 'electric';
  return 'invalid';
}

function mapStatus(raw: string): string | 'invalid' {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (!v) return 'in_stock';
  if (STATUSES.has(v)) return v;
  if (v === 'available' || v === 'stock') return 'in_stock';
  return 'invalid';
}

export type VehicleImportResult = { ok: number; failed: number; updated: number; errors: string[] };

export async function importVehicleSpreadsheetRows(
  supabase: SupabaseClient,
  profileId: string,
  rows: Record<string, string>[]
): Promise<VehicleImportResult> {
  let ok = 0;
  let failed = 0;
  let updated = 0;
  const errors: string[] = [];
  const seenChassis = new Set<string>();

  const { data: existingRows } = await supabase.from('vehicles').select('id, chassis_number');
  const existingByNorm = new Map<string, string>();
  for (const row of existingRows || []) {
    existingByNorm.set(normalizeChassis((row as { chassis_number: string }).chassis_number), (row as { id: string }).id);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const chassis = (r.chassis_number || '').trim();
    const make = (r.make || '').trim();
    const model = (r.model || '').trim();
    const country = resolveSourceCountryFromRow(r);

    if (!chassis || !make || !model) {
      failed++;
      errors.push(`Row ${line}: chassis_number, make, and model are required`);
      continue;
    }
    if (!country) {
      failed++;
      errors.push(`Row ${line}: source_country or source_country_code is required (ISO-2 or country name)`);
      continue;
    }
    const chassisKey = normalizeChassis(chassis);
    if (seenChassis.has(chassisKey)) {
      failed++;
      errors.push(`Row ${line}: duplicate chassis_number in this file`);
      continue;
    }
    seenChassis.add(chassisKey);

    const year = parseOptionalNumber(r.model_year);
    const regYear = parseOptionalNumber(r.registration_year);
    const mileage = parseOptionalNumber(r.mileage_km);
    const purchase = parseOptionalNumber(r.purchase_price);
    const listed = parseOptionalNumber(r.listed_price);
    if (!year.ok || !regYear.ok || !mileage.ok || !purchase.ok || !listed.ok) {
      failed++;
      errors.push(`Row ${line}: numeric field is invalid`);
      continue;
    }

    const transmission = mapTransmission(r.transmission || '');
    const fuel = mapFuel(r.fuel_type || '');
    const status = mapStatus(r.status || '');
    if (transmission === 'invalid') {
      failed++;
      errors.push(`Row ${line}: transmission must be automatic, manual, cvt, or other`);
      continue;
    }
    if (fuel === 'invalid') {
      failed++;
      errors.push(`Row ${line}: fuel_type must be petrol, diesel, hybrid, electric, or other`);
      continue;
    }
    if (status === 'invalid') {
      failed++;
      errors.push(`Row ${line}: invalid status`);
      continue;
    }

    const images = splitImageUrls(r);
    const payload: Record<string, unknown> = {
      chassis_number: chassis,
      make,
      model,
      model_grade: r.model_grade?.trim() || null,
      model_year: year.value,
      registration_year: regYear.value,
      color: r.color?.trim() || null,
      mileage_km: mileage.value,
      transmission,
      fuel_type: fuel,
      source_country: country.name,
      source_country_code: country.code,
      source_supplier: r.source_supplier?.trim() || null,
      purchase_price: purchase.value,
      purchase_currency: (r.purchase_currency || 'JPY').trim().toUpperCase() || 'JPY',
      listed_price: listed.value,
      listed_currency: (r.listed_currency || 'USD').trim().toUpperCase() || 'USD',
      location: r.location?.trim() || null,
      arrival_date: r.arrival_date?.trim() || null,
      status,
      notes: r.notes?.trim() || null,
    };
    if (images[0]) payload.primary_image_url = images[0];

    const existingId = existingByNorm.get(chassisKey);
    let vehicleId = existingId || null;
    let error: { message: string } | null = null;

    if (existingId) {
      payload.updated_at = new Date().toISOString();
      const upd = await supabase.from('vehicles').update(payload).eq('id', existingId);
      error = upd.error;
      if (error && /source_country_code/i.test(error.message)) {
        const { source_country_code: _code, ...withoutCode } = payload;
        void _code;
        const retry = await supabase.from('vehicles').update(withoutCode).eq('id', existingId);
        error = retry.error;
      }
      if (!error) updated++;
    } else {
      payload.created_by = profileId;
      let ins = await supabase.from('vehicles').insert(payload).select('id').maybeSingle();
      if (ins.error && /source_country_code/i.test(ins.error.message)) {
        const { source_country_code: _code, ...withoutCode } = payload;
        void _code;
        ins = await supabase.from('vehicles').insert(withoutCode).select('id').maybeSingle();
      }
      error = ins.error;
      vehicleId = (ins.data as { id: string } | null)?.id || null;
      if (vehicleId) existingByNorm.set(chassisKey, vehicleId);
    }

    if (error || !vehicleId) {
      failed++;
      errors.push(`Row ${line}: ${error?.message || 'save failed'}`);
      continue;
    }

    if (images.length > 0) {
      await supabase.from('vehicle_images').delete().eq('vehicle_id', vehicleId);
      await supabase.from('vehicle_images').insert(
        images.map((image_url, idx) => ({
          vehicle_id: vehicleId,
          image_url,
          sort_order: idx,
          is_primary: idx === 0,
        }))
      );
    }
    ok++;
  }

  return { ok, failed, updated, errors };
}
