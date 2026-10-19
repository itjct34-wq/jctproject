'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MultiImageUpload, type GalleryImage } from '@/components/shared/multi-image-upload';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import { loadVehicleImages, saveVehicleImages } from '@/lib/utils/vehicle-images';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Props = {
  vehicleId: string;
  chassisNumber?: string | null;
  stockNumber?: string | null;
  partSku?: string | null;
  /** When false, photos are view-only (no upload controls). */
  canEdit?: boolean;
  className?: string;
  /** Called after a successful save so parents can refresh covers. */
  onSaved?: () => void;
};

/**
 * Standalone yard-arrival photo upload (image_role = yard, ERP only).
 * Saves immediately so staff can add yard pics from View Info without opening Edit.
 */
export function YardPhotosSection({
  vehicleId,
  chassisNumber,
  stockNumber,
  partSku,
  canEdit = true,
  className,
  onSaved,
}: Props) {
  const [yardImages, setYardImages] = useState<GalleryImage[]>([]);
  const [allImages, setAllImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const imgs = await loadVehicleImages(vehicleId);
      setAllImages(imgs);
      setYardImages(imgs.filter((img) => img.image_role === 'yard'));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const folder = chassisStorageFolder(chassisNumber || partSku || stockNumber || vehicleId);

  const onYardChange = async (nextYard: GalleryImage[]) => {
    if (!canEdit) return;
    const nonYard = allImages.filter((img) => img.image_role !== 'yard');
    const merged = [
      ...nonYard,
      ...nextYard.map((img, i) => ({
        ...img,
        image_role: 'yard' as const,
        is_primary: false,
        sort_order: nonYard.length + i,
      })),
    ].map((img, i) => ({ ...img, sort_order: i }));

    setYardImages(nextYard);
    setAllImages(merged);
    setSaving(true);
    try {
      await saveVehicleImages(vehicleId, merged);
      toast.success('Yard photos saved');
      onSaved?.();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save yard photos');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={cn(
        'space-y-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
            Yard photos
          </h3>
          <p className="text-[11px] text-emerald-900/70">
            Arrival / yard condition — ERP only (not on public site). Prefix <code>Y.</code> /{' '}
            <code>Y_</code> also works in ZIP import.
          </p>
        </div>
        {saving || loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden />
        ) : null}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading yard photos…</p>
      ) : canEdit ? (
        <MultiImageUpload
          folder={folder}
          images={yardImages}
          onChange={(next) => void onYardChange(next)}
          label="Yard gallery"
          forceRole="yard"
          groupByRole={false}
          maxImages={30}
        />
      ) : yardImages.length ? (
        <div className="flex flex-wrap gap-1.5">
          {yardImages.map((img) => (
            <a
              key={img.id || img.image_url}
              href={img.image_url}
              target="_blank"
              rel="noreferrer"
              className="h-14 w-[4.5rem] overflow-hidden rounded border bg-muted ring-1 ring-emerald-500/40 sm:h-16 sm:w-20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt="" className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No yard photos yet.</p>
      )}
    </section>
  );
}
