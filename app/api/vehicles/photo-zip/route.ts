import { NextRequest, NextResponse } from 'next/server';
import { requireInventoryStaff } from '@/lib/admin-auth';
import { inspectVehiclePhotoZip, MAX_PHOTO_BYTES, MAX_PHOTO_ZIP_BYTES } from '@/lib/utils/vehicle-photo-zip';
import { chassisStorageFolder, imageContentType } from '@/lib/utils/chassis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Optional server unzip for smaller archives.
 * The ERP wizard unzips in the browser so a 200MB photo ZIP is not blocked by
 * serverless body limits. This route is for staff tools / fallbacks under 20MB.
 */
const API_ZIP_LIMIT = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireInventoryStaff(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const form = await request.formData();
  const zip = form.get('zip');
  if (!(zip instanceof File)) {
    return NextResponse.json({ error: 'zip file is required' }, { status: 400 });
  }
  if (zip.size > API_ZIP_LIMIT) {
    return NextResponse.json(
      { error: `Server ZIP limit is ${Math.round(API_ZIP_LIMIT / 1024 / 1024)}MB. Use Bulk import step 2 in the ERP (up to ${Math.round(MAX_PHOTO_ZIP_BYTES / 1024 / 1024)}MB).` },
      { status: 413 }
    );
  }

  let { data: vehicles, error: vErr } = await admin.from('vehicles').select('id, chassis_number, stock_number, part_sku');
  if (vErr) {
    ({ data: vehicles, error: vErr } = await admin.from('vehicles').select('id, chassis_number, stock_number'));
  }
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });

  const inspected = await inspectVehiclePhotoZip(
    zip,
    (vehicles || []) as { id: string; chassis_number: string; stock_number?: string | null; part_sku?: string | null }[]
  );

  const attached: { chassis: string; photos: number }[] = [];
  for (const match of inspected.matches) {
    if (!match.vehicleId) continue;
    const folder = chassisStorageFolder(match.chassis || match.folder);
    const rows: { vehicle_id: string; image_url: string; sort_order: number; is_primary: boolean }[] = [];
    for (let p = 0; p < match.photos.length; p++) {
      const photo = match.photos[p];
      const blob = await photo.asyncBlob();
      if (blob.size > MAX_PHOTO_BYTES) continue;
      const safe = photo.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
      const path = `${folder}/${String(p + 1).padStart(3, '0')}-${safe}`;
      const buffer = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await admin.storage.from('vehicle-images').upload(path, buffer, {
        upsert: true,
        contentType: imageContentType(photo.name),
      });
      if (upErr) continue;
      const { data: pub } = admin.storage.from('vehicle-images').getPublicUrl(path);
      rows.push({
        vehicle_id: match.vehicleId,
        image_url: pub.publicUrl,
        sort_order: rows.length,
        is_primary: rows.length === 0,
      });
    }
    if (rows.length === 0) continue;
    await admin.from('vehicle_images').delete().eq('vehicle_id', match.vehicleId);
    await admin.from('vehicle_images').insert(rows);
    await admin.from('vehicles').update({
      primary_image_url: rows[0].image_url,
      updated_at: new Date().toISOString(),
    }).eq('id', match.vehicleId);
    attached.push({ chassis: match.chassis || match.folder, photos: rows.length });
  }

  return NextResponse.json({
    attached,
    unmatched_folders: inspected.unmatchedFolders,
    skipped: inspected.skipped,
  });
}
