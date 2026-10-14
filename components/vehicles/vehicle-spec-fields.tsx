'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiImageUpload, type GalleryImage } from '@/components/shared/multi-image-upload';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import type { Vehicle } from '@/lib/types';

export type VehicleSpecForm = {
  chassis_number: string;
  stock_number: string;
  make: string;
  model: string;
  colour: string;
  model_year: string;
  engine: string;
  transmission: string;
};

export function mapTransmissionToDb(raw: string): Vehicle['transmission'] | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (['automatic', 'auto', 'at', 'a/t'].includes(v)) return 'automatic';
  if (['manual', 'mt', 'm/t', 'stick'].includes(v)) return 'manual';
  if (v === 'cvt') return 'cvt';
  return 'other';
}

type Props = {
  form: VehicleSpecForm;
  onChange: (patch: Partial<VehicleSpecForm>) => void;
  gallery: GalleryImage[];
  onGalleryChange: (images: GalleryImage[]) => void;
};

export function VehicleSpecFields({ form, onChange, gallery, onGalleryChange }: Props) {
  const folder = chassisStorageFolder(form.chassis_number);
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px]">Chassis *</Label>
          <Input
            value={form.chassis_number}
            onChange={(e) => onChange({ chassis_number: e.target.value })}
            placeholder="Chassis number"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Stock no.</Label>
          <Input
            value={form.stock_number}
            onChange={(e) => onChange({ stock_number: e.target.value })}
            placeholder="Stock"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Make *</Label>
          <Input
            value={form.make}
            onChange={(e) => onChange({ make: e.target.value })}
            placeholder="Make"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Model *</Label>
          <Input
            value={form.model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="Model"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Colour</Label>
          <Input
            value={form.colour}
            onChange={(e) => onChange({ colour: e.target.value })}
            placeholder="Colour"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Year</Label>
          <Input
            value={form.model_year}
            onChange={(e) => onChange({ model_year: e.target.value })}
            placeholder="2016"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Engine</Label>
          <Input
            value={form.engine}
            onChange={(e) => onChange({ engine: e.target.value })}
            placeholder="1500cc"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Transmission</Label>
          <Input
            value={form.transmission}
            onChange={(e) => onChange({ transmission: e.target.value })}
            placeholder="Automatic"
          />
        </div>
      </div>
      <MultiImageUpload
        folder={folder}
        images={gallery}
        onChange={onGalleryChange}
        label="Photos"
      />
    </>
  );
}
