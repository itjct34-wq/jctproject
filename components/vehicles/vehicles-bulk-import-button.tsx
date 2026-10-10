'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BulkImportDialog } from '@/components/shared/bulk-import-dialog';
import { VEHICLE_CSV_HEADERS, VEHICLE_CSV_SAMPLE } from '@/lib/utils/csv-import';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  onDone?: () => void;
};

export function VehiclesBulkImportButton({ onDone }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const handleImport = async (rows: Record<string, string>[]) => {
    if (!profile) return { ok: 0, failed: rows.length, errors: ['Not signed in'] };
    let ok = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const chassis = (r.chassis_number || '').trim();
      const make = (r.make || '').trim();
      const model = (r.model || '').trim();
      if (!chassis || !make || !model) {
        failed++;
        errors.push(`Row ${i + 2}: chassis, make, model required`);
        continue;
      }
      const { error } = await supabase.from('vehicles').insert({
        chassis_number: chassis,
        make,
        model,
        model_grade: r.model_grade?.trim() || null,
        model_year: r.model_year ? Number(r.model_year) : null,
        registration_year: r.registration_year ? Number(r.registration_year) : null,
        color: r.color?.trim() || null,
        mileage_km: r.mileage_km ? Number(r.mileage_km) : null,
        transmission: r.transmission?.trim() || null,
        fuel_type: r.fuel_type?.trim() || null,
        source_country: r.source_country?.trim() || 'Japan',
        source_supplier: r.source_supplier?.trim() || null,
        purchase_price: r.purchase_price ? Number(r.purchase_price) : null,
        purchase_currency: (r.purchase_currency || 'JPY').toUpperCase(),
        listed_price: r.listed_price ? Number(r.listed_price) : null,
        listed_currency: (r.listed_currency || 'USD').toUpperCase(),
        location: r.location?.trim() || null,
        arrival_date: r.arrival_date?.trim() || null,
        status: r.status?.trim() || 'in_stock',
        notes: r.notes?.trim() || null,
        primary_image_url: r.primary_image_url?.trim() || null,
        created_by: profile.id,
      });
      if (error) {
        failed++;
        errors.push(`Row ${i + 2}: ${error.message}`);
      } else {
        ok++;
      }
    }

    if (ok > 0) {
      toast.success(`Imported ${ok} vehicle(s)`);
      onDone?.();
    }
    return { ok, failed, errors };
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-1.5 h-4 w-4" />
        Bulk import
      </Button>
      <BulkImportDialog
        open={open}
        onOpenChange={setOpen}
        title="Bulk import vehicles"
        headers={VEHICLE_CSV_HEADERS}
        sampleRow={VEHICLE_CSV_SAMPLE}
        templateFilename="jct-vehicles-template.csv"
        onImport={handleImport}
      />
    </>
  );
}
