'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { loadVehicleImages } from '@/lib/utils/vehicle-images';
import { downloadVehicleImagesZip } from '@/lib/utils/download-vehicle-images-zip';

type Props = {
  vehicleId: string;
  stockNumber: string;
  className?: string;
  /** Compact icon button for stock list cards. */
  variant?: 'icon' | 'outline';
  size?: 'sm' | 'default' | 'icon';
  label?: string;
};

export function DownloadVehicleImagesButton({
  vehicleId,
  stockNumber,
  className,
  variant = 'icon',
  size = 'icon',
  label = 'Download photos ZIP',
}: Props) {
  const [busy, setBusy] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const images = await loadVehicleImages(vehicleId);
      const result = await downloadVehicleImagesZip(stockNumber || vehicleId, images);
      if (result === 'empty') {
        toast.message('No photos to download for this vehicle');
        return;
      }
      toast.success('Photo ZIP downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build photo ZIP');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size={size === 'icon' ? 'icon' : size}
        className={cn(
          'h-7 w-7 shrink-0 text-sky-800 hover:bg-sky-50 hover:text-sky-950',
          className
        )}
        title={label}
        aria-label={label}
        disabled={busy}
        onClick={(e) => void onClick(e)}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size === 'icon' ? 'sm' : size}
      className={cn(className)}
      disabled={busy}
      onClick={(e) => void onClick(e)}
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
