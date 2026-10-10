'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  bucket: 'vehicle-images' | 'avatars';
  /** Folder prefix inside bucket, e.g. vehicle id or user id */
  folder: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  maxBytes?: number;
};

export function ImageUpload({
  bucket,
  folder,
  value,
  onChange,
  label = 'Photo',
  maxBytes = 5 * 1024 * 1024,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`Image must be under ${Math.round(maxBytes / 1024 / 1024)}MB`);
      return;
    }
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    onChange(url);
    setUploading(false);
    toast.success('Image uploaded');
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="mr-1.5 h-3.5 w-3.5" />Upload from device</>
            )}
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">JPG / PNG / WebP · max {Math.round(maxBytes / 1024 / 1024)}MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
