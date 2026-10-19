'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { Camera, ChevronLeft, ChevronRight, Loader2, Star, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import {
  classifyVehicleImageFileName,
  vehicleImageRoleLabel,
  type VehicleImageRole,
} from '@/lib/vehicles/image-role';

export type GalleryImage = {
  id?: string;
  image_url: string;
  sort_order: number;
  is_primary?: boolean;
  image_role?: VehicleImageRole;
};

type Props = {
  folder: string;
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  label?: string;
  maxImages?: number;
  maxBytes?: number;
  /** When true, group thumbnails by auction / front / back / gallery. */
  groupByRole?: boolean;
};

const ROLE_ORDER: VehicleImageRole[] = ['auction_sheet', 'front', 'back', 'gallery'];

export function MultiImageUpload({
  folder,
  images,
  onChange,
  label = 'Vehicle photos',
  maxImages = 20,
  maxBytes = 5 * 1024 * 1024,
  groupByRole = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast.error('Please choose image files');
      return;
    }
    if (images.length + list.length > maxImages) {
      toast.error(`Maximum ${maxImages} photos`);
      return;
    }
    setUploading(true);
    const next = [...images];
    for (const file of list) {
      if (file.size > maxBytes) {
        toast.error(`${file.name} is over ${Math.round(maxBytes / 1024 / 1024)}MB`);
        continue;
      }
      const role = classifyVehicleImageFileName(file.name);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rolePrefix = role === 'auction_sheet' ? 'A' : role === 'front' ? 'F' : role === 'back' ? 'B' : 'G';
      const path = `${chassisStorageFolder(folder)}/${rolePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from('vehicle-images').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      next.push({
        image_url: url,
        sort_order: next.length,
        is_primary: false,
        image_role: role,
      });
    }
    const hasPublicPrimary = next.some((i) => i.is_primary && i.image_role !== 'auction_sheet');
    if (!hasPublicPrimary) {
      const front = next.find((i) => i.image_role === 'front');
      const firstPublic = front || next.find((i) => i.image_role !== 'auction_sheet');
      if (firstPublic) {
        for (const img of next) img.is_primary = img === firstPublic;
      }
    }
    onChange(next);
    setUploading(false);
    toast.success('Photos uploaded');
  };

  const removeAt = (idx: number) => {
    const next = images.filter((_, i) => i !== idx).map((img, i) => ({
      ...img,
      sort_order: i,
    }));
    if (next.length && !next.some((i) => i.is_primary && i.image_role !== 'auction_sheet')) {
      const cover = next.find((i) => i.image_role === 'front') || next.find((i) => i.image_role !== 'auction_sheet');
      if (cover) {
        for (const img of next) img.is_primary = img === cover;
      }
    }
    onChange(next);
    if (previewIndex != null) {
      if (next.length === 0) setPreviewIndex(null);
      else if (previewIndex >= next.length) setPreviewIndex(next.length - 1);
    }
  };

  const setPrimary = (idx: number) => {
    if (images[idx]?.image_role === 'auction_sheet') {
      toast.error('Auction sheet photos cannot be the public cover');
      return;
    }
    onChange(images.map((img, i) => ({ ...img, is_primary: i === idx })));
  };

  const moveAt = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    onChange(next.map((img, i) => ({ ...img, sort_order: i })));
    if (previewIndex === idx) setPreviewIndex(target);
    else if (previewIndex === target) setPreviewIndex(idx);
  };

  const goPreview = useCallback(
    (dir: number) => {
      if (previewIndex == null || images.length === 0) return;
      setPreviewIndex((previewIndex + dir + images.length) % images.length);
    },
    [previewIndex, images.length]
  );

  useEffect(() => {
    if (previewIndex == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewIndex(null);
      if (event.key === 'ArrowRight') goPreview(1);
      if (event.key === 'ArrowLeft') goPreview(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex, goPreview]);

  const renderTile = (img: GalleryImage, idx: number) => (
    <div
      key={img.id || img.image_url + idx}
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg border bg-muted',
        img.is_primary && img.image_role !== 'auction_sheet' && 'ring-2 ring-primary',
        img.image_role === 'auction_sheet' && 'ring-1 ring-amber-500/60'
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0"
        onClick={() => setPreviewIndex(idx)}
        aria-label={`Preview photo ${idx + 1}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.image_url} alt="" className="h-full w-full object-cover" />
      </button>
      <span className="pointer-events-none absolute left-1 top-1 z-[1] rounded bg-black/65 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
        {vehicleImageRoleLabel(img.image_role)}
      </span>
      {images.length > 1 ? (
        <div className="absolute right-1 top-1 z-[1] flex gap-0.5">
          <button
            type="button"
            title="Move left"
            aria-label="Move photo left"
            className="rounded bg-black/55 p-0.5 text-white hover:bg-black/75 disabled:opacity-35"
            disabled={idx === 0}
            onClick={(e) => {
              e.stopPropagation();
              moveAt(idx, -1);
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Move right"
            aria-label="Move photo right"
            className="rounded bg-black/55 p-0.5 text-white hover:bg-black/75 disabled:opacity-35"
            disabled={idx === images.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              moveAt(idx, 1);
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-[1] flex justify-between gap-1 bg-black/55 p-1">
        <button
          type="button"
          title={img.image_role === 'auction_sheet' ? 'ERP only — not public cover' : 'Set as primary'}
          className="rounded p-0.5 text-white hover:text-amber-300 disabled:opacity-40"
          disabled={img.image_role === 'auction_sheet'}
          onClick={() => setPrimary(idx)}
        >
          <Star className={cn('h-3.5 w-3.5', img.is_primary && img.image_role !== 'auction_sheet' && 'fill-amber-400 text-amber-400')} />
        </button>
        <button
          type="button"
          title="Remove"
          className="rounded p-0.5 text-white hover:text-red-300"
          onClick={() => removeAt(idx)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const sections = groupByRole
    ? ROLE_ORDER.map((role) => ({
        role,
        items: images
          .map((img, idx) => ({ img, idx }))
          .filter(({ img }) => (img.image_role || 'gallery') === role),
      })).filter((s) => s.items.length > 0)
    : [{ role: 'gallery' as VehicleImageRole, items: images.map((img, idx) => ({ img, idx })) }];

  const previewImage = previewIndex != null ? images[previewIndex] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading || images.length >= maxImages}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading…</>
          ) : (
            <><Upload className="mr-1.5 h-3.5 w-3.5" />Add photos</>
          )}
        </Button>
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
        >
          <Camera className="h-7 w-7 opacity-50" />
          <span className="text-xs">Upload photos — name with A. / F. / B. prefixes</span>
        </button>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.role} className="space-y-1.5">
              {groupByRole ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {vehicleImageRoleLabel(section.role)}
                  {section.role === 'auction_sheet' ? ' · ERP only' : ''}
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {section.items.map(({ img, idx }) => renderTile(img, idx))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        JPG / PNG / WebP · up to {maxImages} · max {Math.round(maxBytes / 1024 / 1024)}MB ·
        {' '}A./A_ = auction (ERP only) · F./F_ = front · B./B_ = back · star = public cover ·
        {' '}click photo to preview · arrows reorder
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {previewImage ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/92"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery preview"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm">
              {(previewIndex ?? 0) + 1} / {images.length}
              {previewImage.image_role
                ? ` · ${vehicleImageRoleLabel(previewImage.image_role)}`
                : ''}
            </p>
            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"
              aria-label="Close gallery"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-12">
            {images.length > 1 ? (
              <button
                type="button"
                onClick={() => goPreview(-1)}
                className="absolute left-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage.image_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {images.length > 1 ? (
              <button
                type="button"
                onClick={() => goPreview(1)}
                className="absolute right-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-4"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
