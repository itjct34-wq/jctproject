'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BulkImportDialog } from '@/components/shared/bulk-import-dialog';
import { AUCTION_CSV_HEADERS, AUCTION_CSV_SAMPLE } from '@/lib/utils/csv-import';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

type Props = { onDone?: () => void };

export function AuctionsBulkImportButton({ onDone }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const handleImport = async (rows: Record<string, string>[]) => {
    if (!profile) return { ok: 0, failed: rows.length, errors: ['Not signed in'] };
    let ok = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const make = (r.make || '').trim();
      const model = (r.model || '').trim();
      if (!make || !model) {
        failed++;
        errors.push(`Row ${i + 2}: make and model required`);
        continue;
      }
      const result = (r.result || 'pending').trim().toLowerCase();
      const validResults = ['pending', 'won', 'lost', 'cancelled'];
      const { error } = await supabase.from('auction_listings').insert({
        chassis_number: r.chassis_number?.trim() || null,
        make,
        model,
        model_year: r.model_year ? Number(r.model_year) : null,
        auction_date: r.auction_date?.trim() || null,
        lot_number: r.lot_number?.trim() || null,
        start_price: r.start_price ? Number(r.start_price) : null,
        currency: (r.currency || 'JPY').toUpperCase(),
        result: validResults.includes(result) ? result : 'pending',
        notes: r.notes?.trim() || null,
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
      toast.success(`Imported ${ok} auction listing(s)`);
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
        title="Bulk import auction listings"
        headers={AUCTION_CSV_HEADERS}
        sampleRow={AUCTION_CSV_SAMPLE}
        templateFilename="jct-auctions-template.csv"
        onImport={handleImport}
      />
    </>
  );
}
