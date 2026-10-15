import { NextRequest, NextResponse } from 'next/server';
import { requireInventoryStaff } from '@/lib/admin-auth';
import type { BulkImportBatch, BulkImportBatchPayload } from '@/lib/types';
import { vehicleImageStoragePath } from '@/lib/stock/bulk-import-batches';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Admin = Awaited<ReturnType<typeof requireInventoryStaff>> extends infer T
  ? T extends { admin: infer A }
    ? A
    : never
  : never;

async function restoreVehicleCover(
  admin: Admin,
  vehicleId: string,
  previousPrimary: string | null | undefined
) {
  const { data: remaining } = await admin
    .from('vehicle_images')
    .select('id, image_url, is_primary, sort_order')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: true });
  const rows = remaining || [];
  if (rows.length === 0) {
    await admin
      .from('vehicles')
      .update({
        primary_image_url: previousPrimary || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicleId);
    return;
  }
  const primary = rows.find((r) => r.is_primary) || rows[0];
  if (!primary.is_primary) {
    await admin.from('vehicle_images').update({ is_primary: false }).eq('vehicle_id', vehicleId);
    await admin.from('vehicle_images').update({ is_primary: true }).eq('id', primary.id);
  }
  await admin
    .from('vehicles')
    .update({
      primary_image_url: primary.image_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId);
}

async function removeStoragePaths(admin: Admin, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    await admin.storage.from('vehicle-images').remove(chunk);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireInventoryStaff(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: 'Batch id is required' }, { status: 400 });
  }

  const { data: batch, error: loadErr } = await admin
    .from('bulk_import_batches')
    .select('id, kind, source, filename, created_by, created_at, payload, status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr || !batch) {
    return NextResponse.json({ error: loadErr?.message || 'Batch not found' }, { status: 404 });
  }

  const row = batch as BulkImportBatch;
  if (row.status === 'deleted') {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  const payload = (row.payload || {}) as BulkImportBatchPayload;
  const notes: string[] = [];
  let vehiclesRemoved = 0;
  let listingsRemoved = 0;
  let photosRemoved = 0;

  if (row.source === 'sheet') {
    const createdIds = payload.created_vehicle_ids || [];
    if (createdIds.length > 0) {
      const skip = new Set<string>();
      const { data: vehicleRows } = await admin
        .from('vehicles')
        .select('id, status, payment_status')
        .in('id', createdIds);
      for (const v of vehicleRows || []) {
        if (
          ['reserved', 'sold', 'in_transit', 'exported'].includes(String(v.status)) ||
          ['reserved', 'partial_paid', 'paid'].includes(String(v.payment_status))
        ) {
          skip.add(v.id as string);
          notes.push(`Vehicle ${String(v.id).slice(0, 8)}… skipped: reserved or sold`);
        }
      }
      const candidates = createdIds.filter((id) => !skip.has(id));
      if (candidates.length > 0) {
        const { data: invoiceHits } = await admin
          .from('invoice_items')
          .select('vehicle_id')
          .in('vehicle_id', candidates);
        for (const rowHit of invoiceHits || []) {
          if (rowHit.vehicle_id) {
            skip.add(rowHit.vehicle_id as string);
            notes.push(`Vehicle ${String(rowHit.vehicle_id).slice(0, 8)}… skipped: has invoice line`);
          }
        }
        const { data: saleHits } = await admin
          .from('sales')
          .select('vehicle_id')
          .in('vehicle_id', candidates);
        for (const rowHit of saleHits || []) {
          if (rowHit.vehicle_id) {
            skip.add(rowHit.vehicle_id as string);
            notes.push(`Vehicle ${String(rowHit.vehicle_id).slice(0, 8)}… skipped: has sale`);
          }
        }
      }

      const toRemove = createdIds.filter((id) => !skip.has(id));
      if (toRemove.length > 0) {
        const { data: images } = await admin
          .from('vehicle_images')
          .select('image_url')
          .in('vehicle_id', toRemove);
        const paths = (images || [])
          .map((img) => vehicleImageStoragePath(img.image_url))
          .filter((p): p is string => Boolean(p));
        await removeStoragePaths(admin, paths);

        for (const vehicleId of toRemove) {
          const { error } = await admin.from('vehicles').delete().eq('id', vehicleId);
          if (error) {
            notes.push(`Vehicle ${vehicleId.slice(0, 8)}… kept: ${error.message}`);
          } else {
            vehiclesRemoved += 1;
          }
        }
      }
    }

    const listingIds = payload.listing_ids || [];
    if (listingIds.length > 0) {
      const { error, count } = await admin
        .from('auction_listings')
        .delete({ count: 'exact' })
        .in('id', listingIds);
      if (error) {
        notes.push(`Auction listings: ${error.message}`);
      } else {
        listingsRemoved = count || listingIds.length;
      }
    }
  } else {
    const imageIds = payload.image_ids || [];
    const vehicleIds = payload.vehicle_ids || [];
    const previousCovers = new Map(
      (payload.previous_covers || []).map((c) => [c.vehicle_id, c.primary_image_url])
    );

    let urls: string[] = [];
    if (imageIds.length > 0) {
      const { data: images } = await admin
        .from('vehicle_images')
        .select('id, image_url')
        .in('id', imageIds);
      urls = (images || []).map((img) => img.image_url);
      const { error } = await admin.from('vehicle_images').delete().in('id', imageIds);
      if (error) {
        notes.push(`Photos: ${error.message}`);
      } else {
        photosRemoved = images?.length || 0;
      }
    }

    const paths = [
      ...(payload.storage_paths || []),
      ...urls.map((u) => vehicleImageStoragePath(u)).filter((p): p is string => Boolean(p)),
    ];
    await removeStoragePaths(admin, paths);

    const deletedUrlSet = new Set(urls);
    for (const vehicleId of vehicleIds) {
      const prev = previousCovers.get(vehicleId) || null;
      const restorePrev = prev && !deletedUrlSet.has(prev) ? prev : null;
      await restoreVehicleCover(admin, vehicleId, restorePrev);
    }
  }

  await admin
    .from('bulk_import_batches')
    .update({ status: 'deleted' })
    .eq('id', id);

  return NextResponse.json({
    ok: true,
    vehiclesRemoved,
    listingsRemoved,
    photosRemoved,
    notes,
  });
}
