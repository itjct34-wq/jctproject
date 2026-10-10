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

export async function saveVehicleImages(vehicleId: string, images: GalleryImage[]) {
  await supabase.from('vehicle_images').delete().eq('vehicle_id', vehicleId);
  if (images.length === 0) {
    await supabase.from('vehicles').update({ primary_image_url: null }).eq('id', vehicleId);
    return;
  }
  const rows = images.map((img, idx) => ({
    vehicle_id: vehicleId,
    image_url: img.image_url,
    sort_order: idx,
    is_primary: Boolean(img.is_primary) || idx === 0,
  }));
  // ensure only one primary
  const primaryIdx = rows.findIndex((r) => r.is_primary);
  rows.forEach((r, i) => {
    r.is_primary = i === (primaryIdx >= 0 ? primaryIdx : 0);
  });
  const { error } = await supabase.from('vehicle_images').insert(rows);
  if (error) throw error;
  const primary = rows.find((r) => r.is_primary)?.image_url || rows[0].image_url;
  await supabase.from('vehicles').update({ primary_image_url: primary }).eq('id', vehicleId);
}
