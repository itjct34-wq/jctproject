'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import {
  AVATAR_OUTPUT_SIZE,
  getCroppedAvatarFile,
  type PixelCrop,
} from '@/lib/avatar-crop';

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (file: File) => void | Promise<void>;
  saving?: boolean;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onCropped,
  saving = false,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [exporting, setExporting] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels({
      x: pixels.x,
      y: pixels.y,
      width: pixels.width,
      height: pixels.height,
    });
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (saving || exporting) return;
    if (!next) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
    onOpenChange(next);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setExporting(true);
    try {
      const file = await getCroppedAvatarFile(imageSrc, croppedAreaPixels);
      await onCropped(file);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } finally {
      setExporting(false);
    }
  };

  const busy = saving || exporting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust profile photo</DialogTitle>
          <DialogDescription>
            Drag to center your face. Zoom so it fits the circle — saved as a {AVATAR_OUTPUT_SIZE}×
            {AVATAR_OUTPUT_SIZE} square for the ERP avatar.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2 px-1">
          <Label htmlFor="avatar-zoom" className="text-xs text-muted-foreground">
            Zoom
          </Label>
          <Slider
            id="avatar-zoom"
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            disabled={busy || !imageSrc}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleApply()} disabled={busy || !croppedAreaPixels}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Use photo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
