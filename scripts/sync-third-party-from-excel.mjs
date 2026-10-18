/**
 * Apply AA Third Party sheet JSON (or Excel via --json) onto vehicles
 * where procurement_source = third_party, matched by normalized chassis.
 *
 *   python ... -> .cursor/third_party_sheet_rows.json
 *   node scripts/sync-third-party-from-excel.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DEFAULT_TT_RATE = 155;
const FIXED_EXPENSE_JPY = 45_000;
const DEFAULT_JSON = path.join('.cursor', 'third_party_sheet_rows.json');

function normalizeChassis(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s_./\\]/g, '');
}

function mapTransmission(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (['automatic', 'manual', 'cvt', 'other'].includes(v)) return v;
  if (['at', 'auto', 'a/t'].includes(v)) return 'automatic';
  if (['mt', 'manual', 'm/t', 'stick'].includes(v)) return 'manual';
  return 'other';
}

function mapFuel(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (['petrol', 'diesel', 'hybrid', 'electric', 'other'].includes(v)) return v;
  if (['gasoline', 'gas', 'ice', 'unleaded'].includes(v)) return 'petrol';
  if (['light oil', 'lightoil', 'gasoil', 'gas oil', 'diesel'].includes(v)) return 'diesel';
  if (['hv', 'hev', 'phv', 'phev'].includes(v)) return 'hybrid';
  if (['ev', 'bev'].includes(v)) return 'electric';
  return 'other';
}

function mapStatus(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!v || v === 'available' || v === 'stock') return 'in_stock';
  const ok = new Set(['in_stock', 'reserved', 'sold', 'in_transit', 'exported', 'on_hold', 'archived', 'hidden']);
  return ok.has(v) ? v : 'in_stock';
}

function resolveCountry(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v || v === 'japan' || v === 'jpn' || v === 'jp') return { code: 'JP', name: 'Japan' };
  if (v.length === 2) return { code: v.toUpperCase(), name: String(raw).trim() };
  return { code: 'JP', name: String(raw).trim() || 'Japan' };
}

function fobFromOnceJpy(oncePrice) {
  const amount = Math.max(0, Number(oncePrice) || 0);
  const fobJpy = amount + FIXED_EXPENSE_JPY;
  const fobUsd = fobJpy / DEFAULT_TT_RATE;
  return {
    purchase_price: amount,
    fob_jpy: Math.round(fobJpy),
    fob_usd: Math.round(fobUsd),
    listed_price: Math.round(fobUsd),
  };
}

function buildPayload(row) {
  const country = resolveCountry(row.country || 'Japan');
  const once = row.buying;
  const pricing = once != null ? fobFromOnceJpy(once) : null;
  const listedFromSheet = row.fob != null ? Math.round(row.fob) : null;

  const noteBits = [];
  if (row.engine_cc != null) noteBits.push(`engine: ${Math.round(row.engine_cc)}cc`);
  if (row.features) noteBits.push(row.features);
  if (row.lot) noteBits.push(`lot: ${row.lot}`);
  noteBits.push(`AA sheet sync ${new Date().toISOString().slice(0, 10)}`);

  const payload = {
    make: row.make || 'Unknown',
    model: row.model || 'Pending',
    model_grade: row.grade || null,
    model_year: row.year != null ? Math.round(row.year) : null,
    color: row.color || null,
    mileage_km: row.mileage != null ? Math.round(row.mileage) : null,
    transmission: mapTransmission(row.transmission),
    fuel_type: mapFuel(row.fuel),
    source_country: country.name,
    source_country_code: country.code,
    shipping_port_of_loading: row.port || null,
    status: mapStatus(row.status),
    procurement_source: 'third_party',
    notes: noteBits.filter(Boolean).join('\n') || null,
    updated_at: new Date().toISOString(),
  };

  if (row.dealership) {
    payload.dealership_name = row.dealership;
    payload.source_supplier = row.dealership;
  }

  if (pricing) {
    payload.once_price = pricing.purchase_price;
    payload.once_price_currency = 'JPY';
    payload.purchase_price = pricing.purchase_price;
    payload.purchase_currency = 'JPY';
    payload.expense_jpy = FIXED_EXPENSE_JPY;
    payload.tt_rate = DEFAULT_TT_RATE;
    payload.fob_jpy = pricing.fob_jpy;
    payload.fob_usd = listedFromSheet ?? pricing.fob_usd;
    payload.listed_price = listedFromSheet ?? pricing.listed_price;
    payload.listed_currency = 'USD';
  } else if (listedFromSheet != null) {
    payload.listed_price = listedFromSheet;
    payload.listed_currency = 'USD';
    payload.fob_usd = listedFromSheet;
  }

  return payload;
}

async function loadThirdPartyVehicles(admin) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, chassis_number, make, model, procurement_source, dealership_name, once_price, listed_price, status')
      .eq('procurement_source', 'third_party')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  const jsonPath = process.argv[2] || DEFAULT_JSON;
  if (!fs.existsSync(jsonPath)) {
    console.error('Missing sheet JSON. Generate with openpyxl export first:', jsonPath);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const sheetRows = parsed.rows || [];
  const byChassis = new Map();
  for (const row of sheetRows) {
    const key = normalizeChassis(row.chassis);
    if (key) byChassis.set(key, row);
  }
  console.log(`sheet unique chassis: ${byChassis.size}`);

  const admin = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const vehicles = await loadThirdPartyVehicles(admin);
  console.log(`third_party vehicles in DB: ${vehicles.length}`);

  const byNorm = new Map();
  for (const v of vehicles) {
    const key = normalizeChassis(v.chassis_number);
    if (key) byNorm.set(key, v);
  }

  let matched = 0;
  let updated = 0;
  let failed = 0;
  const unmatchedSheet = [];
  const unmatchedDb = [];
  const errors = [];
  const pairs = [];

  for (const [norm, row] of byChassis) {
    const vehicle = byNorm.get(norm);
    if (!vehicle) {
      unmatchedSheet.push(row.chassis);
      continue;
    }
    matched += 1;
    pairs.push({ norm, row, vehicle });
    byNorm.delete(norm);
  }
  for (const v of byNorm.values()) unmatchedDb.push(v.chassis_number);

  console.log(`matched pairs to update: ${pairs.length}`);
  const concurrency = 8;
  for (let i = 0; i < pairs.length; i += concurrency) {
    const chunk = pairs.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async ({ row, vehicle }) => {
        const payload = buildPayload(row);
        const { error } = await admin.from('vehicles').update(payload).eq('id', vehicle.id);
        return { chassis: row.chassis, error: error?.message || null };
      })
    );
    for (const r of results) {
      if (r.error) {
        failed += 1;
        errors.push(`${r.chassis}: ${r.error}`);
      } else {
        updated += 1;
      }
    }
    console.log(`progress ${Math.min(i + concurrency, pairs.length)}/${pairs.length}`);
  }

  const summary = {
    uniqueSheetChassis: byChassis.size,
    dbThirdParty: vehicles.length,
    matched,
    updated,
    failed,
    unmatchedSheet: unmatchedSheet.length,
    unmatchedDbThirdParty: unmatchedDb.length,
  };
  console.log('\n=== sync summary ===');
  console.log(JSON.stringify(summary, null, 2));
  if (unmatchedSheet.length) console.log('sample unmatched sheet:', unmatchedSheet.slice(0, 25));
  if (unmatchedDb.length) console.log('sample unmatched DB:', unmatchedDb.slice(0, 25));
  if (errors.length) console.log('errors:', errors.slice(0, 20));
  fs.writeFileSync(
    path.join('.cursor', 'third_party_sync_summary.json'),
    JSON.stringify({ ...summary, unmatchedSheetSample: unmatchedSheet.slice(0, 50), unmatchedDbSample: unmatchedDb.slice(0, 50), errors: errors.slice(0, 50) }, null, 2)
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
