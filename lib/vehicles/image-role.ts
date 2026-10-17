/** Roles persisted on public.vehicle_images.image_role */
export type VehicleImageRole = 'gallery' | 'front' | 'back' | 'auction_sheet';

export const VEHICLE_IMAGE_ROLES: VehicleImageRole[] = [
  'front',
  'back',
  'gallery',
  'auction_sheet',
];

export const PUBLIC_VEHICLE_IMAGE_ROLES: VehicleImageRole[] = ['front', 'back', 'gallery'];

/**
 * Classify a photo by basename prefix (case-insensitive).
 *
 * Matching rules (first match wins on the basename only, not folder path):
 * 1. Starts with `A.` or `A_` → `auction_sheet` (ERP only; never public)
 * 2. Starts with `F.` or `F_` → `front`
 * 3. Starts with `B.` or `B_` → `back`
 * 4. Otherwise → `gallery`
 *
 * Examples: `A.sheet.jpg`, `a_001.png`, `F.1.jpg`, `B.rear.webp`, `001.jpg`
 */
export function classifyVehicleImageFileName(fileName: string): VehicleImageRole {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  if (!base) return 'gallery';
  const match = base.match(/^([AFB])[._]/i);
  if (!match) return 'gallery';
  const letter = match[1].toUpperCase();
  if (letter === 'A') return 'auction_sheet';
  if (letter === 'F') return 'front';
  if (letter === 'B') return 'back';
  return 'gallery';
}

export function isPublicVehicleImageRole(role: string | null | undefined): boolean {
  return role !== 'auction_sheet';
}

/** Prefer front cover, then any non-auction image. Never auction sheet. */
export function pickPrimaryImageUrl<T extends { image_url: string; image_role?: string | null; is_primary?: boolean | null }>(
  rows: T[]
): string | null {
  const publicRows = rows.filter((r) => isPublicVehicleImageRole(r.image_role));
  if (!publicRows.length) return null;
  const starred = publicRows.find((r) => r.is_primary);
  if (starred?.image_url) return starred.image_url;
  const front = publicRows.find((r) => r.image_role === 'front');
  if (front?.image_url) return front.image_url;
  return publicRows[0]?.image_url || null;
}

export function roleSortRank(role: string | null | undefined): number {
  if (role === 'front') return 0;
  if (role === 'back') return 1;
  if (role === 'gallery') return 2;
  if (role === 'auction_sheet') return 3;
  return 2;
}

export function vehicleImageRoleLabel(role: string | null | undefined): string {
  if (role === 'auction_sheet') return 'Auction sheet';
  if (role === 'front') return 'Front';
  if (role === 'back') return 'Back';
  return 'Gallery';
}
