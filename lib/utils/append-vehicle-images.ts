import type { SupabaseClient } from '@supabase/supabase-js';
import { vehicleImageStoragePath } from '@/lib/stock/bulk-import-batches';
import {
  isPublicVehicleImageRole,
  pickPrimaryImageUrl,
  type VehicleImageRole,
} from '@/lib/vehicles/image-role';

type ImageRow = {
  id: string;
  image_url: string;
  sort_order: number | null;
  is_primary: boolean | null;
  image_role?: string | null;
};

export async function appendVehicleImageUrls(
  db: SupabaseClient,
  vehicleId: string,
  imageUrls: string[],
  opts?: { imageRole?: VehicleImageRole }
): Promise<{ inserted: number; ids: string[] }> {
  const unique = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return { inserted: 0, ids: [] };
  const role = opts?.imageRole || 'gallery';

  const { data: existing, error: loadErr } = await db
    .from('vehicle_images')
    .select('id, image_url, sort_order, is_primary, image_role')
    .eq('vehicle_id', vehicleId);
  if (loadErr) throw loadErr;

  const rows = (existing || []) as ImageRow[];
  const have = new Set(rows.map((r) => r.image_url));
  const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1);
  const hasPublicPrimary = rows.some((r) => r.is_primary && isPublicVehicleImageRole(r.image_role));
  const toInsert = unique
    .filter((url) => !have.has(url))
    .map((image_url, i) => ({
      vehicle_id: vehicleId,
      image_url,
      sort_order: maxOrder + 1 + i,
      is_primary: !hasPublicPrimary && isPublicVehicleImageRole(role) && i === 0,
      image_role: role,
    }));

  if (toInsert.length === 0) return { inserted: 0, ids: [] };

  const { data, error } = await db.from('vehicle_images').insert(toInsert).select('id, image_url');
  if (error) throw error;

  if (!hasPublicPrimary) {
    const cover = pickPrimaryImageUrl([
      ...rows.map((r) => ({
        image_url: r.image_url,
        image_role: r.image_role || 'gallery',
        is_primary: r.is_primary,
      })),
      ...toInsert,
    ]);
    if (cover) {
      await db
        .from('vehicles')
        .update({ primary_image_url: cover, updated_at: new Date().toISOString() })
        .eq('id', vehicleId);
    }
  }

  return { inserted: toInsert.length, ids: (data || []).map((r) => r.id as string) };
}

export async function removeVehicleImageStorage(db: SupabaseClient, imageUrls: string[]) {
  const paths = [...new Set(imageUrls.map((u) => vehicleImageStoragePath(u)).filter((p): p is string => Boolean(p)))];
  for (let i = 0; i < paths.length; i += 50) {
    await db.storage.from('vehicle-images').remove(paths.slice(i, i + 50));
  }
}
