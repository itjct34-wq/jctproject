'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderArchive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import {
  inspectVehiclePhotoZip,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_ZIP_BYTES,
} from '@/lib/utils/vehicle-photo-zip';
import { loadVehicleImages } from '@/lib/utils/vehicle-images';
import type { GalleryImage } from '@/components/shared/multi-image-upload';

type Props = {
  vehicleId: string | null;
  chassisNumber: string;
  stockNumber?: string | null;
  partSku?: string | null;
  onGalleryReload?: (images: GalleryImage[]) => void;
  /** When creating (no id yet), queue the ZIP until after save. */
  pendingZip?: File | null;
  onPendingZip?: (file: File | null) => void;
  disabled?: boolean;
};

export async function uploadVehiclePhotoZipForId(
  vehicleId: string,
  zip: File,
  row: { chassis_number: string; stock_number?: string | null; part_sku?: string | null }
): Promise<{ photos: number; errors: string[] }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session expired. Sign in again.');

  const inspected = await inspectVehiclePhotoZip(
    zip,
    [{ id: vehicleId, ...row }],
    { preferVehicleId: vehicleId }
  );
  const match = inspected.matches.find((m) => m.vehicleId === vehicleId);
  if (!match || match.photos.length === 0) {
    const hint = inspected.unmatchedFolders[0] || inspected.skipped[0] || 'No matching photos';
    throw new Error(
      `No photos matched this unit. Use a folder named after chassis/stock/SKU (e.g. RU3-123123/). ${hint}`
    );
  }

  const form = new FormData();
  form.append('vehicle_id', vehicleId);
  const errors: string[] = [...inspected.skipped];
  for (const photo of match.photos) {
    const blob = await photo.asyncBlob();
    if (blob.size > MAX_PHOTO_BYTES) {
      errors.push(`${photo.name}: too large`);
      continue;
    }
    form.append('files', blob, photo.name);
  }
  const res = await fetch('/api/vehicles/gallery', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    photos?: number;
    error?: string;
    errors?: string[];
  };
  if (!res.ok) throw new Error(payload.error || res.statusText);
  return { photos: Number(payload.photos) || 0, errors: [...errors, ...(payload.errors || [])] };
}

export function VehiclePhotoZipUpload({
  vehicleId,
  chassisNumber,
  stockNumber,
  partSku,
  onGalleryReload,
  pendingZip,
  onPendingZip,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_PHOTO_ZIP_BYTES) {
      toast.error(`ZIP is too large (max ${Math.round(MAX_PHOTO_ZIP_BYTES / 1024 / 1024)}MB)`);
      return;
    }
    if (!vehicleId) {
      onPendingZip?.(file);
      toast.message(`ZIP queued: ${file.name}`, {
        description: 'It will import after you save this stock unit.',
      });
      return;
    }
    setLoading(true);
    try {
      const result = await uploadVehiclePhotoZipForId(vehicleId, file, {
        chassis_number: chassisNumber,
        stock_number: stockNumber,
        part_sku: partSku,
      });
      if (result.photos > 0) {
        toast.success(`Attached ${result.photos} photo(s) from ZIP`);
        const imgs = await loadVehicleImages(vehicleId);
        onGalleryReload?.(imgs);
      } else {
        toast.error(result.errors[0] || 'No photos uploaded');
      }
      if (result.errors.length) {
        toast.message(result.errors.slice(0, 3).join(' · '));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ZIP upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Reading ZIP…</>
        ) : (
          <><FolderArchive className="mr-1.5 h-3.5 w-3.5" />Upload photos ZIP</>
        )}
      </Button>
      {pendingZip ? (
        <span className="text-xs text-muted-foreground">Queued: {pendingZip.name}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
