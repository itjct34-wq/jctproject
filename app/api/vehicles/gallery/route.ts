import { NextRequest, NextResponse } from 'next/server';
import { requireInventoryStaff } from '@/lib/admin-auth';
import { chassisStorageFolder, imageContentType, isImageFileName } from '@/lib/utils/chassis';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_VEHICLE } from '@/lib/utils/vehicle-photo-zip';
import {
  classifyVehicleImageFileName,
  pickPrimaryImageUrl,
  type VehicleImageRole,
} from '@/lib/vehicles/image-role';

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
    .select('id, chassis_number, stock_number, part_sku, primary_image_url')
    .eq('id', vehicleId)
    .maybeSingle();
  if (vErr || !vehicle) {
    return NextResponse.json({ error: vErr?.message || 'Vehicle not found' }, { status: 404 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No image files were sent' }, { status: 400 });
  }

  const { data: existing } = await admin
    .from('vehicle_images')
    .select('id, sort_order, is_primary, image_url, image_role')
    .eq('vehicle_id', vehicleId);
  const existingCount = existing?.length || 0;
  const folder = chassisStorageFolder(
    vehicle.chassis_number || vehicle.part_sku || vehicle.stock_number || vehicleId
  );
  const rows: {
    vehicle_id: string;
    image_url: string;
    sort_order: number;
    is_primary: boolean;
    image_role: VehicleImageRole;
  }[] = [];
  const errors: string[] = [];
  const room = Math.max(0, MAX_PHOTOS_PER_VEHICLE - existingCount);
  if (room === 0) {
    return NextResponse.json({ error: 'Photo limit reached for this vehicle' }, { status: 400 });
  }

  const hasPublicPrimary = (existing || []).some(
    (r) => r.is_primary && r.image_role !== 'auction_sheet'
  );

  for (const file of files.slice(0, room)) {
    if (!isImageFileName(file.name)) {
      errors.push(`${file.name}: not a jpg/png/webp/gif`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      errors.push(`${file.name}: larger than ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}MB`);
      continue;
    }
    const role = classifyVehicleImageFileName(file.name);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const rolePrefix = role === 'auction_sheet' ? 'A' : role === 'front' ? 'F' : role === 'back' ? 'B' : 'G';
    const path = `${folder}/${rolePrefix}-${String(existingCount + rows.length + 1).padStart(3, '0')}-${Date.now()}.${ext}`;
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
      sort_order: existingCount + rows.length,
      is_primary: false,
      image_role: role,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] || 'Storage rejected every photo', errors, photos: 0 },
      { status: 400 }
    );
  }

  if (!hasPublicPrimary) {
    const cover = pickPrimaryImageUrl(rows);
    if (cover) {
      for (const row of rows) {
        row.is_primary = row.image_url === cover;
      }
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('vehicle_images')
    .insert(rows)
    .select('id, image_url, image_role');
  if (insErr) {
    return NextResponse.json({ error: insErr.message, errors }, { status: 400 });
  }

  const shouldSetCover = !vehicle.primary_image_url || !hasPublicPrimary;
  if (shouldSetCover) {
    const cover =
      pickPrimaryImageUrl(rows) ||
      pickPrimaryImageUrl(
        (existing || []).map((r) => ({
          image_url: r.image_url as string,
          image_role: (r.image_role as string) || 'gallery',
          is_primary: r.is_primary,
        }))
      );
    if (cover) {
      await admin.from('vehicles').update({
        primary_image_url: cover,
        updated_at: new Date().toISOString(),
      }).eq('id', vehicleId);
    }
  }

  const imageIds = (inserted || []).map((row) => row.id as string);
  const storagePaths = rows
    .map((row) => {
      const marker = '/object/public/vehicle-images/';
      const idx = row.image_url.indexOf(marker);
      return idx === -1 ? null : decodeURIComponent(row.image_url.slice(idx + marker.length).split('?')[0]);
    })
    .filter((p): p is string => Boolean(p));

  const roleCounts = rows.reduce(
    (acc, row) => {
      acc[row.image_role] = (acc[row.image_role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    photos: rows.length,
    errors,
    image_ids: imageIds,
    vehicle_id: vehicleId,
    previous_primary_image_url: vehicle.primary_image_url || null,
    storage_paths: storagePaths,
    role_counts: roleCounts,
  });
}
