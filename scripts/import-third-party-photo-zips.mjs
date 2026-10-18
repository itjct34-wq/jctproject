/**
 * One-off: create/match third-party vehicles from AA photo ZIPs and attach images.
 *
 * Requires in env (or .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   POSTGRES_URL / POSTGRES_URL_NON_POOLING — apply migration 055 first via apply-procurement-055.mjs
 *
 * Usage:
 *   node scripts/import-third-party-photo-zips.mjs [zip1] [zip2] ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);

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

const MAX_PHOTOS_PER_VEHICLE = 30;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function normalizeChassis(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s_./\\]/g, '');
}

function chassisStorageFolder(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'unknown';
}

function isJunkZipPath(p) {
  const parts = p.split(/[/\\]/).filter(Boolean);
  if (parts.some((x) => x === '__MACOSX' || x.startsWith('._') || x === '.DS_Store' || x === 'Thumbs.db')) {
    return true;
  }
  const file = parts[parts.length - 1] || '';
  return !file || file.startsWith('.') || file === '__MACOSX';
}

function isImageFileName(name) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
}

function imageContentType(name) {
  const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function classifyRole(fileName) {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  const match = base.match(/^([AFB])[._]/i);
  if (!match) return 'gallery';
  const letter = match[1].toUpperCase();
  if (letter === 'A') return 'auction_sheet';
  if (letter === 'F') return 'front';
  if (letter === 'B') return 'back';
  return 'gallery';
}

function roleSortRank(role) {
  if (role === 'front') return 0;
  if (role === 'back') return 1;
  if (role === 'gallery') return 2;
  if (role === 'auction_sheet') return 3;
  return 2;
}

function pickPrimary(rows) {
  const publicRows = rows.filter((r) => r.image_role !== 'auction_sheet');
  if (!publicRows.length) return null;
  const front = publicRows.find((r) => r.image_role === 'front');
  return (front || publicRows[0])?.image_url || null;
}

const DEFAULT_ZIPS = [
  'C:\\Users\\ATJ\\Downloads\\AA_2026-10-02_184446_100-cars.zip',
  'C:\\Users\\ATJ\\Downloads\\AA_2026-10-02_185403_100-cars.zip',
  'C:\\Users\\ATJ\\Downloads\\AA_2026-10-02_184103_100-cars.zip',
  'C:\\Users\\ATJ\\Downloads\\AA_2026-10-02_184834_100-cars.zip',
];

async function loadVehicles(admin) {
  let { data, error } = await admin.from('vehicles').select('id, chassis_number, stock_number, part_sku, procurement_source');
  if (error && /procurement_source/i.test(error.message || '')) {
    ({ data, error } = await admin.from('vehicles').select('id, chassis_number, stock_number, part_sku'));
  }
  if (error) throw new Error(error.message);
  return data || [];
}

async function ensureCreatorId(admin) {
  const { data } = await admin.from('profiles').select('id').eq('is_active', true).limit(1);
  if (data?.[0]?.id) return data[0].id;
  const { data: any } = await admin.from('profiles').select('id').limit(1);
  if (any?.[0]?.id) return any[0].id;
  throw new Error('No profiles found for created_by');
}

async function createThirdParty(admin, folder, creatorId) {
  const chassis = folder.trim();
  const payload = {
    chassis_number: chassis,
    make: 'Unknown',
    model: 'Pending',
    stock_category: 'car',
    status: 'in_stock',
    procurement_source: 'third_party',
    dealership_name: null,
    once_price: null,
    once_price_currency: 'JPY',
    notes: `Photo-ZIP import ${new Date().toISOString().slice(0, 10)} (third_party)`,
    created_by: creatorId,
  };
  let ins = await admin.from('vehicles').insert(payload).select('id').maybeSingle();
  if (ins.error && /procurement_source|dealership_name|once_price/i.test(ins.error.message || '')) {
    const stripped = { ...payload };
    delete stripped.procurement_source;
    delete stripped.dealership_name;
    delete stripped.once_price;
    delete stripped.once_price_currency;
    ins = await admin.from('vehicles').insert(stripped).select('id').maybeSingle();
  }
  if (ins.error || !ins.data?.id) {
    throw new Error(ins.error?.message || 'insert failed');
  }
  return ins.data.id;
}

async function attachPhotos(admin, vehicleId, folder, photos) {
  const storageFolder = chassisStorageFolder(folder);
  const { data: existing } = await admin
    .from('vehicle_images')
    .select('id, sort_order, is_primary, image_url, image_role')
    .eq('vehicle_id', vehicleId);
  const existingCount = existing?.length || 0;
  const hasPublicPrimary = (existing || []).some((r) => r.is_primary && r.image_role !== 'auction_sheet');

  const rows = [];
  const errors = [];
  for (let p = 0; p < photos.length; p++) {
    const photo = photos[p];
    const buf = photo.buffer;
    if (buf.length > MAX_PHOTO_BYTES) {
      errors.push(`${photo.name}: too large`);
      continue;
    }
    const safe = photo.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
    const rolePrefix =
      photo.role === 'auction_sheet' ? 'A' : photo.role === 'front' ? 'F' : photo.role === 'back' ? 'B' : 'G';
    const objectPath = `${storageFolder}/${rolePrefix}-${String(existingCount + p + 1).padStart(3, '0')}-${Date.now()}-${safe}`;
    const { error: upErr } = await admin.storage.from('vehicle-images').upload(objectPath, buf, {
      upsert: true,
      contentType: imageContentType(photo.name),
    });
    if (upErr) {
      errors.push(`${photo.name}: ${upErr.message}`);
      continue;
    }
    const { data: pub } = admin.storage.from('vehicle-images').getPublicUrl(objectPath);
    rows.push({
      vehicle_id: vehicleId,
      image_url: pub.publicUrl,
      sort_order: existingCount + rows.length,
      is_primary: false,
      image_role: photo.role,
    });
  }
  if (rows.length === 0) return { photos: 0, errors };

  if (!hasPublicPrimary) {
    const cover = pickPrimary(rows);
    if (cover) {
      for (const row of rows) row.is_primary = row.image_url === cover;
    }
  }
  const { error: insErr } = await admin.from('vehicle_images').insert(rows);
  if (insErr) {
    errors.push(insErr.message);
    return { photos: 0, errors };
  }
  if (existingCount === 0 || !hasPublicPrimary) {
    const cover = pickPrimary([
      ...(existing || []).map((r) => ({
        image_url: r.image_url,
        image_role: r.image_role || 'gallery',
      })),
      ...rows,
    ]);
    if (cover) {
      await admin
        .from('vehicles')
        .update({ primary_image_url: cover, updated_at: new Date().toISOString() })
        .eq('id', vehicleId);
    }
  }
  return { photos: rows.length, errors };
}

async function processZip(admin, zipPath, byNorm, creatorId, stats) {
  const name = path.basename(zipPath);
  console.log(`\n=== ${name} ===`);
  if (!fs.existsSync(zipPath)) {
    stats.errors.push(`${name}: missing file`);
    return;
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  /** @type {Map<string, { folder: string; photos: { name: string; role: string; buffer: Buffer }[] }>} */
  const groups = new Map();

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const full = entry.name.replace(/\\/g, '/');
    if (isJunkZipPath(full)) continue;
    const parts = full.split('/').filter(Boolean);
    const fileName = parts.pop() || '';
    if (!isImageFileName(fileName)) continue;
    if (parts.length === 0) continue;
    const folder = parts[parts.length - 1];
    const key = normalizeChassis(folder);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { folder, photos: [] });
    const group = groups.get(key);
    const buffer = Buffer.from(await entry.async('uint8array'));
    group.photos.push({ name: fileName, role: classifyRole(fileName), buffer });
  }

  for (const group of groups.values()) {
    group.photos.sort((a, b) => {
      const rd = roleSortRank(a.role) - roleSortRank(b.role);
      if (rd !== 0) return rd;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    if (group.photos.length > MAX_PHOTOS_PER_VEHICLE) {
      stats.errors.push(`${group.folder}: truncated to ${MAX_PHOTOS_PER_VEHICLE} photos`);
      group.photos = group.photos.slice(0, MAX_PHOTOS_PER_VEHICLE);
    }
  }

  console.log(`folders=${groups.size}`);
  for (const [norm, group] of groups) {
    let vehicleId = byNorm.get(norm) || null;
    let created = false;
    try {
      if (!vehicleId) {
        vehicleId = await createThirdParty(admin, group.folder, creatorId);
        byNorm.set(norm, vehicleId);
        created = true;
        stats.created += 1;
      } else {
        await admin
          .from('vehicles')
          .update({
            procurement_source: 'third_party',
            updated_at: new Date().toISOString(),
          })
          .eq('id', vehicleId);
        stats.matched += 1;
      }
      const attached = await attachPhotos(admin, vehicleId, group.folder, group.photos);
      stats.photos += attached.photos;
      if (attached.photos > 0) stats.vehiclesWithPhotos += 1;
      for (const e of attached.errors) stats.errors.push(`${group.folder}: ${e}`);
      if (created) stats.createdFolders.push(group.folder);
    } catch (err) {
      stats.failed += 1;
      stats.errors.push(`${group.folder}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function main() {
  const zips = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ZIPS;
  const admin = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // Fail fast if migration missing
  const probe = await admin.from('vehicles').select('id, procurement_source').limit(1);
  if (probe.error && /procurement_source/i.test(probe.error.message || '')) {
    console.error('BLOCKER: procurement_source column missing. Apply migration 055 first.');
    console.error(probe.error.message);
    process.exit(2);
  }

  const vehicles = await loadVehicles(admin);
  const byNorm = new Map();
  for (const v of vehicles) {
    for (const alias of [v.chassis_number, v.stock_number, v.part_sku]) {
      const key = normalizeChassis(alias || '');
      if (key && !byNorm.has(key)) byNorm.set(key, v.id);
    }
  }
  const creatorId = await ensureCreatorId(admin);

  const stats = {
    created: 0,
    matched: 0,
    failed: 0,
    photos: 0,
    vehiclesWithPhotos: 0,
    createdFolders: [],
    errors: [],
  };

  for (const z of zips) {
    await processZip(admin, z, byNorm, creatorId, stats);
  }

  console.log('\n=== SUMMARY ===');
  console.log(
    JSON.stringify(
      {
        created: stats.created,
        matched_existing: stats.matched,
        failed: stats.failed,
        photos_attached: stats.photos,
        vehicles_with_photos: stats.vehiclesWithPhotos,
        error_count: stats.errors.length,
        errors_sample: stats.errors.slice(0, 25),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
