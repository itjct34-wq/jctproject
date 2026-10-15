import { supabase } from '@/lib/supabase/client';
import type { GalleryImage } from '@/components/shared/multi-image-upload';

export async function loadVehicleImages(vehicleId: string): Promise<GalleryImage[]> {
  const { data, error } = await supabase
    .from('vehicle_images')
    .select('id, image_url, sort_order, is_primary')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []) as GalleryImage[];
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

  const primaryIdx = images.findIndex((img) => img.is_primary);
  const primaryAt = primaryIdx >= 0 ? primaryIdx : 0;

  const toInsert = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ img }) => !img.id)
    .map(({ img, idx }) => ({
      vehicle_id: vehicleId,
      image_url: img.image_url,
      sort_order: idx,
      is_primary: idx === primaryAt,
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
        is_primary: idx === primaryAt,
        image_url: img.image_url,
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
    .select('image_url, is_primary, sort_order')
    .eq('vehicle_id', vehicleId)
    .order('sort_order', { ascending: true });
  if (reloadError) throw reloadError;
  const primary = (rows || []).find((r) => r.is_primary)?.image_url || rows?.[0]?.image_url || null;
  await supabase.from('vehicles').update({ primary_image_url: primary }).eq('id', vehicleId);
}
