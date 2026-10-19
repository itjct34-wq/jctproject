/** Roles persisted on public.vehicle_images.image_role */
export type VehicleImageRole = 'gallery' | 'front' | 'back' | 'auction_sheet' | 'yard';

export const VEHICLE_IMAGE_ROLES: VehicleImageRole[] = [
  'front',
  'back',
  'gallery',
  'auction_sheet',
  'yard',
];

export const PUBLIC_VEHICLE_IMAGE_ROLES: VehicleImageRole[] = ['front', 'back', 'gallery'];

export const ERP_ONLY_VEHICLE_IMAGE_ROLES: VehicleImageRole[] = ['auction_sheet', 'yard'];

/**
 * Classify a photo by basename prefix (case-insensitive).
 *
 * Matching rules (first match wins on the basename only, not folder path):
 * 1. Starts with `A.` or `A_` → `auction_sheet` (ERP only; never public)
 * 2. Starts with `F.` or `F_` → `front`
 * 3. Starts with `B.` or `B_` → `back`
 * 4. Starts with `Y.` or `Y_` → `yard` (ERP only; yard arrival / condition)
 * 5. Otherwise → `gallery`
 *
 * Examples: `A.sheet.jpg`, `a_001.png`, `F.1.jpg`, `B.rear.webp`, `Y.1.jpg`, `001.jpg`
 */
export function classifyVehicleImageFileName(fileName: string): VehicleImageRole {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  if (!base) return 'gallery';
  const match = base.match(/^([AFBY])[._]/i);
  if (!match) return 'gallery';
  const letter = match[1].toUpperCase();
  if (letter === 'A') return 'auction_sheet';
  if (letter === 'F') return 'front';
  if (letter === 'B') return 'back';
  if (letter === 'Y') return 'yard';
  return 'gallery';
}

export function isErpOnlyVehicleImageRole(role: string | null | undefined): boolean {
  return role === 'auction_sheet' || role === 'yard';
}

export function isPublicVehicleImageRole(role: string | null | undefined): boolean {
  return !isErpOnlyVehicleImageRole(role);
}

/** Prefer front cover, then any non-ERP image. Never auction sheet or yard. */
export function pickPrimaryImageUrl<
  T extends { image_url: string; image_role?: string | null; is_primary?: boolean | null },
>(rows: T[]): string | null {
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
  if (role === 'yard') return 3;
  if (role === 'auction_sheet') return 4;
  return 2;
}

export function vehicleImageRoleLabel(role: string | null | undefined): string {
  if (role === 'auction_sheet') return 'Auction sheet';
  if (role === 'front') return 'Front';
  if (role === 'back') return 'Back';
  if (role === 'yard') return 'Yard';
  return 'Gallery';
}

/** Storage filename prefix letter for a role. */
export function vehicleImageRoleStoragePrefix(role: VehicleImageRole): string {
  switch (role) {
    case 'auction_sheet':
      return 'A';
    case 'front':
      return 'F';
    case 'back':
      return 'B';
    case 'yard':
      return 'Y';
    case 'gallery':
      return 'G';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/** ZIP subfolder name for a role. */
export function vehicleImageRoleZipFolder(role: string | null | undefined): string {
  if (role === 'auction_sheet') return 'auction_sheet';
  if (role === 'front') return 'front';
  if (role === 'back') return 'back';
  if (role === 'yard') return 'yard';
  return 'gallery';
}
