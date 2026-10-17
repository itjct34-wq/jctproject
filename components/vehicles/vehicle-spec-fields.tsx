'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiImageUpload, type GalleryImage } from '@/components/shared/multi-image-upload';
import { STOCK_CATEGORIES, stockCategoryLabel, type StockCategory } from '@/lib/stock-category';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import { supabase } from '@/lib/supabase/client';
import { fetchVehicleMakes, fetchVehicleModels, type VehicleMakeRow, type VehicleModelRow } from '@/lib/shipping-catalog';
import type { Vehicle } from '@/lib/types';

export type VehicleSpecForm = {
  stock_category: StockCategory;
  chassis_number: string;
  stock_number: string;
  part_sku: string;
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
  gallery?: GalleryImage[];
  onGalleryChange?: (images: GalleryImage[]) => void;
  showPhotos?: boolean;
};

export function VehicleSpecFields({ form, onChange, gallery = [], onGalleryChange, showPhotos = true }: Props) {
  const folder = chassisStorageFolder(form.chassis_number || form.part_sku || form.stock_number);
  const parts = form.stock_category === 'parts';
  const [makes, setMakes] = useState<VehicleMakeRow[]>([]);
  const [models, setModels] = useState<VehicleModelRow[]>([]);

  useEffect(() => {
    void fetchVehicleMakes(supabase).then(({ data }) => setMakes(data));
  }, []);

  const makeId = useMemo(
    () => makes.find((m) => m.name.toLowerCase() === form.make.trim().toLowerCase())?.id || null,
    [makes, form.make]
  );

  useEffect(() => {
    if (!makeId) {
      setModels([]);
      return;
    }
    void fetchVehicleModels(supabase, makeId).then(({ data }) => setModels(data));
  }, [makeId]);

  return (
    <>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs">Category *</Label>
          <Select
            value={form.stock_category}
            onValueChange={(v) => onChange({ stock_category: v as StockCategory })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{stockCategoryLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs">{parts ? 'Part number / chassis *' : 'Chassis *'}</Label>
          <Input
            value={form.chassis_number}
            onChange={(e) => onChange({ chassis_number: e.target.value })}
            placeholder={parts ? 'Part number or chassis' : 'Chassis number'}
            required={!parts}
          />
        </div>
        {parts ? (
          <div className="space-y-0.5">
            <Label className="text-xs">Part SKU</Label>
            <Input
              value={form.part_sku}
              onChange={(e) => onChange({ part_sku: e.target.value })}
              placeholder="SKU / part no."
            />
          </div>
        ) : null}
        <div className="space-y-0.5">
          <Label className="text-xs">Stock no.</Label>
          <Input
            value={form.stock_number}
            onChange={(e) => onChange({ stock_number: e.target.value })}
            placeholder="V-1001"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Make *</Label>
          <Input
            value={form.make}
            onChange={(e) => onChange({ make: e.target.value, model: '' })}
            placeholder="Make"
            required
            list="vehicle-make-catalog"
          />
          <datalist id="vehicle-make-catalog">
            {makes.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Model *</Label>
          <Input
            value={form.model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="Model"
            required
            list="vehicle-model-catalog"
          />
          <datalist id="vehicle-model-catalog">
            {models.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Colour</Label>
          <Input
            value={form.colour}
            onChange={(e) => onChange({ colour: e.target.value })}
            placeholder="Colour"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Year</Label>
          <Input
            value={form.model_year}
            onChange={(e) => onChange({ model_year: e.target.value })}
            placeholder="2016"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Engine</Label>
          <Input
            value={form.engine}
            onChange={(e) => onChange({ engine: e.target.value })}
            placeholder="1500cc"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Transmission</Label>
          <Input
            value={form.transmission}
            onChange={(e) => onChange({ transmission: e.target.value })}
            placeholder="Automatic"
          />
        </div>
      </div>
      {showPhotos && onGalleryChange ? (
        <MultiImageUpload
          folder={folder}
          images={gallery}
          onChange={onGalleryChange}
          label="Photos"
        />
      ) : null}
    </>
  );
}
