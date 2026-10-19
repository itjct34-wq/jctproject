import { supabase } from '@/lib/supabase/client';
import type { GalleryImage } from '@/components/shared/multi-image-upload';
import {
  isPublicVehicleImageRole,
  pickPrimaryImageUrl,
  type VehicleImageRole,
} from '@/lib/vehicles/image-role';

export async function loadVehicleImages(vehicleId: string): Promise<GalleryImage[]> {
  const { data, error } = await supabase
    .from('vehicle_images')
    .select('id, image_url, sort_order, is_primary, image_role')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: true });
  if (error) {
    // Older DBs without image_role still load the gallery.
    const fallback = await supabase
      .from('vehicle_images')
      .select('id, image_url, sort_order, is_primary')
      .eq('vehicle_id', vehicleId)
      .order('sort_order', { ascending: true });
    if (fallback.error) return [];
    return (fallback.data || []).map((row) => ({
      ...(row as GalleryImage),
      image_role: 'gallery' as VehicleImageRole,
    }));
  }
  return (data || []).map((row) => ({
    id: row.id as string,
    image_url: row.image_url as string,
    sort_order: row.sort_order as number,
    is_primary: Boolean(row.is_primary),
    image_role: ((row.image_role as VehicleImageRole) || 'gallery') as VehicleImageRole,
  }));
}

/** Append / update gallery without wiping existing rows first. */
export async function saveVehicleImages(vehicleId: string, images: GalleryImage[]) {
  const { data: existing, error: loadError } = await supabase
    .from('vehicle_images')
    .select('id')
    .eq('vehicle_id', vehicleId);
  if (loadError) throw loadError;

  const keepIds = new Set(images.map((img) => img.id).filter((id): id is string => Boolean(id)));
  const existingIds = (existing || []).map((row) => row.id as string);

  const publicIdx = images.findIndex(
    (img) => img.is_primary && isPublicVehicleImageRole(img.image_role)
  );
  const fallbackIdx = images.findIndex((img) => isPublicVehicleImageRole(img.image_role));
  const primaryAt = publicIdx >= 0 ? publicIdx : fallbackIdx;

  const toInsert = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ img }) => !img.id)
    .map(({ img, idx }) => ({
      vehicle_id: vehicleId,
      image_url: img.image_url,
      sort_order: idx,
      is_primary: primaryAt >= 0 && idx === primaryAt,
      image_role: img.image_role || 'gallery',
    }));

  if (toInsert.length) {
    const { error } = await supabase.from('vehicle_images').insert(toInsert);
    if (error) throw error;
  }

  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];
    if (!img.id) continue;
    const { error } = await supabase
      .from('vehicle_images')
      .update({
        sort_order: idx,
        is_primary: primaryAt >= 0 && idx === primaryAt,
        image_url: img.image_url,
        image_role: img.image_role || 'gallery',
      })
      .eq('id', img.id)
      .eq('vehicle_id', vehicleId);
    if (error) throw error;
  }

  const toDelete = existingIds.filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    const { data: doomed } = await supabase.from('vehicle_images').select('id, image_url').in('id', toDelete);
    const { error } = await supabase.from('vehicle_images').delete().in('id', toDelete);
    if (error) throw error;
    const { removeVehicleImageStorage } = await import('@/lib/utils/append-vehicle-images');
    await removeVehicleImageStorage(
      supabase,
      (doomed || []).map((row) => row.image_url as string)
    );
  }

  if (images.length === 0) {
    await supabase.from('vehicles').update({ primary_image_url: null }).eq('id', vehicleId);
    return;
  }

  const { data: rows, error: reloadError } = await supabase
    .from('vehicle_images')
    .select('image_url, is_primary, sort_order, image_role')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: true });
  if (reloadError) throw reloadError;
  const primary = pickPrimaryImageUrl(
    (rows || []).map((r) => ({
      image_url: r.image_url as string,
      image_role: (r.image_role as string) || 'gallery',
      is_primary: r.is_primary,
    }))
  );
  await supabase.from('vehicles').update({ primary_image_url: primary }).eq('id', vehicleId);
}
