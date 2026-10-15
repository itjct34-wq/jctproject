import { NextRequest, NextResponse } from 'next/server';
import { requireInventoryStaff } from '@/lib/admin-auth';
import { chassisStorageFolder, imageContentType, isImageFileName } from '@/lib/utils/chassis';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_VEHICLE } from '@/lib/utils/vehicle-photo-zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireInventoryStaff(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const form = await request.formData();
  const vehicleId = String(form.get('vehicle_id') || '').trim();
  if (!vehicleId) {
    return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });
  }

  const { data: vehicle, error: vErr } = await admin
    .from('vehicles')
    .select('id, chassis_number, stock_number, part_sku')
    .eq('id', vehicleId)
    .maybeSingle();
  if (vErr || !vehicle) {
    return NextResponse.json({ error: vErr?.message || 'Vehicle not found' }, { status: 404 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No image files were sent' }, { status: 400 });
  }

  const folder = chassisStorageFolder(
    vehicle.chassis_number || vehicle.part_sku || vehicle.stock_number || vehicleId
  );
  const rows: { vehicle_id: string; image_url: string; sort_order: number; is_primary: boolean }[] = [];
  const errors: string[] = [];

  for (const file of files.slice(0, MAX_PHOTOS_PER_VEHICLE)) {
    if (!isImageFileName(file.name)) {
      errors.push(`${file.name}: not a jpg/png/webp/gif`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      errors.push(`${file.name}: larger than ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}MB`);
      continue;
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${folder}/${String(rows.length + 1).padStart(3, '0')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from('vehicle-images').upload(path, buffer, {
      upsert: true,
      contentType: imageContentType(file.name),
    });
    if (upErr) {
      errors.push(`${file.name}: ${upErr.message}`);
      continue;
    }
    const { data: pub } = admin.storage.from('vehicle-images').getPublicUrl(path);
    rows.push({
      vehicle_id: vehicleId,
      image_url: pub.publicUrl,
      sort_order: rows.length,
      is_primary: rows.length === 0,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] || 'Storage rejected every photo', errors, photos: 0 },
      { status: 400 }
    );
  }

  await admin.from('vehicle_images').delete().eq('vehicle_id', vehicleId);
  const { error: insErr } = await admin.from('vehicle_images').insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message, errors }, { status: 400 });
  }
  await admin.from('vehicles').update({
    primary_image_url: rows[0].image_url,
    updated_at: new Date().toISOString(),
  }).eq('id', vehicleId);

  return NextResponse.json({ photos: rows.length, errors });
}
