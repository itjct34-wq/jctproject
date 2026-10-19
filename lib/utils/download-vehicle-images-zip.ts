import JSZip from 'jszip';
import {
  roleSortRank,
  vehicleImageRoleLabel,
  vehicleImageRoleZipFolder,
} from '@/lib/vehicles/image-role';

export type DownloadableVehicleImage = {
  image_url: string;
  image_role?: string | null;
};

function safeZipSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+|\.+$/g, '');
  return cleaned.slice(0, 80) || 'vehicle';
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() || '';
    const clean = base.split('?')[0] || '';
    const ext = clean.includes('.') ? clean.split('.').pop()!.toLowerCase() : '';
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {
    /* ignore */
  }
  return 'jpg';
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  return res.blob();
}

/**
 * Build a ZIP of every gallery image for one vehicle, grouped by role folders.
 * Returns empty when there are no images (caller should toast).
 */
export async function buildVehicleImagesZip(
  stockNumber: string,
  images: DownloadableVehicleImage[]
): Promise<Blob | null> {
  const list = images.filter((img) => Boolean(img.image_url?.trim()));
  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const roleDiff = roleSortRank(a.image_role) - roleSortRank(b.image_role);
    if (roleDiff !== 0) return roleDiff;
    return a.image_url.localeCompare(b.image_url);
  });

  const zip = new JSZip();
  const root = safeZipSegment(stockNumber || 'vehicle');
  const counters = new Map<string, number>();

  for (const img of sorted) {
    const folder = vehicleImageRoleZipFolder(img.image_role);
    const n = (counters.get(folder) || 0) + 1;
    counters.set(folder, n);
    const ext = extFromUrl(img.image_url);
    const name = `${String(n).padStart(2, '0')}-${vehicleImageRoleLabel(img.image_role)
      .toLowerCase()
      .replace(/\s+/g, '-')}.${ext}`;
    const blob = await fetchImageBlob(img.image_url);
    zip.file(`${root}/${folder}/${name}`, blob);
  }

  return zip.generateAsync({ type: 'blob' });
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export async function downloadVehicleImagesZip(
  stockNumber: string,
  images: DownloadableVehicleImage[]
): Promise<'ok' | 'empty'> {
  const blob = await buildVehicleImagesZip(stockNumber, images);
  if (!blob) return 'empty';
  const base = safeZipSegment(stockNumber || 'vehicle');
  triggerBlobDownload(blob, `${base}-photos.zip`);
  return 'ok';
}
