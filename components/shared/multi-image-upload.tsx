'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { Camera, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type GalleryImage = {
  id?: string;
  image_url: string;
  sort_order: number;
  is_primary?: boolean;
};

type Props = {
  folder: string;
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  label?: string;
  maxImages?: number;
  maxBytes?: number;
};

export function MultiImageUpload({
  folder,
  images,
  onChange,
  label = 'Vehicle photos',
  maxImages = 20,
  maxBytes = 5 * 1024 * 1024,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
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
        is_primary: next.length === 0,
      });
    }
    if (next.length > 0 && !next.some((i) => i.is_primary)) {
      next[0].is_primary = true;
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
    if (next.length && !next.some((i) => i.is_primary)) next[0].is_primary = true;
    onChange(next);
  };

  const setPrimary = (idx: number) => {
    onChange(images.map((img, i) => ({ ...img, is_primary: i === idx })));
  };

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
          <span className="text-xs">Upload multiple photos from device</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <div
              key={img.id || img.image_url + idx}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border bg-muted',
                img.is_primary && 'ring-2 ring-primary'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/55 p-1">
                <button
                  type="button"
                  title="Set as primary"
                  className="rounded p-0.5 text-white hover:text-amber-300"
                  onClick={() => setPrimary(idx)}
                >
                  <Star className={cn('h-3.5 w-3.5', img.is_primary && 'fill-amber-400 text-amber-400')} />
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
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        JPG / PNG / WebP · up to {maxImages} photos · max {Math.round(maxBytes / 1024 / 1024)}MB each · star = primary
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
