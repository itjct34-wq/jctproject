import JSZip from 'jszip';
import {
  chassisStorageFolder,
  imageContentType,
  isImageFileName,
  isJunkZipPath,
  normalizeChassis,
} from '@/lib/utils/chassis';

export const MAX_PHOTO_ZIP_BYTES = 200 * 1024 * 1024;
export const MAX_PHOTOS_PER_VEHICLE = 30;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type VehicleChassisRow = {
  id: string;
  chassis_number: string;
  stock_number?: string | null;
  part_sku?: string | null;
};

/** Storage folder key: chassis, then part SKU, then stock number. */
export function vehiclePhotoFolderKey(
  row: Pick<VehicleChassisRow, 'chassis_number' | 'stock_number' | 'part_sku'>
): string {
  return (row.chassis_number || row.part_sku || row.stock_number || '').trim();
}

export type ZipPhotoEntry = {
  path: string;
  name: string;
  asyncBlob: () => Promise<Blob>;
};

export type ZipFolderMatch = {
  folder: string;
  vehicleId: string | null;
  chassis: string | null;
  photos: ZipPhotoEntry[];
};

function folderSegments(path: string): { folders: string[]; fileName: string } {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  const fileName = parts.pop() || '';
  const folders = parts.filter((p) => p !== '__MACOSX' && !p.startsWith('._'));
  return { folders, fileName };
}

export async function inspectVehiclePhotoZip(
  file: File,
  vehicles: VehicleChassisRow[]
): Promise<{ matches: ZipFolderMatch[]; unmatchedFolders: string[]; skipped: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const byNorm = new Map<string, VehicleChassisRow>();
  for (const v of vehicles) {
    for (const alias of [v.chassis_number, v.stock_number, v.part_sku]) {
      const key = normalizeChassis(alias || '');
      if (key && !byNorm.has(key)) byNorm.set(key, v);
    }
  }

  const groups = new Map<string, ZipFolderMatch>();
  const skipped: string[] = [];

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const path = entry.name.replace(/\\/g, '/');
    if (isJunkZipPath(path)) continue;
    const { folders, fileName } = folderSegments(path);
    if (!isImageFileName(fileName)) continue;
    if (folders.length === 0) {
      skipped.push(`${fileName} (not in a chassis or SKU folder)`);
      continue;
    }

    let vehicle: VehicleChassisRow | null = null;
    let folderLabel = folders[folders.length - 1];
    for (const part of folders) {
      const hit = byNorm.get(normalizeChassis(part));
      if (hit) {
        vehicle = hit;
        folderLabel = part;
        break;
      }
    }

    const groupKey = vehicle ? `id:${vehicle.id}` : `unmatched:${normalizeChassis(folderLabel) || folderLabel}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        folder: folderLabel,
        vehicleId: vehicle?.id || null,
        chassis: vehicle ? vehiclePhotoFolderKey(vehicle) || null : null,
        photos: [],
      };
      groups.set(groupKey, group);
    }
    group.photos.push({
      path,
      name: fileName,
      asyncBlob: () => entry.async('blob'),
    });
  }

  for (const group of groups.values()) {
    group.photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (group.photos.length > MAX_PHOTOS_PER_VEHICLE) {
      skipped.push(`${group.folder}: kept first ${MAX_PHOTOS_PER_VEHICLE} of ${group.photos.length} photos`);
      group.photos = group.photos.slice(0, MAX_PHOTOS_PER_VEHICLE);
    }
  }

  const matches = [...groups.values()].filter((g) => g.vehicleId);
  const unmatchedFolders = [...groups.values()].filter((g) => !g.vehicleId).map((g) => `${g.folder} (${g.photos.length} photos)`);

  return { matches, unmatchedFolders, skipped };
}

export { chassisStorageFolder, imageContentType };
