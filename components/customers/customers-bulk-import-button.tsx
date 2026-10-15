'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BulkImportDialog } from '@/components/shared/bulk-import-dialog';
import { CUSTOMER_CSV_HEADERS, CUSTOMER_CSV_SAMPLE } from '@/lib/utils/csv-import';
import { customerContactErrorMessage, isCustomerConsigneeComplete } from '@/lib/utils/customer-contact';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

type Props = { onDone?: () => void };

const TYPES = new Set(['individual', 'company']);
const STATUSES = new Set(['lead', 'active', 'inactive', 'blocked']);

export function CustomersBulkImportButton({ onDone }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const handleImport = async (rows: Record<string, string>[]) => {
    if (!profile) return { ok: 0, failed: rows.length, errors: ['Not signed in'] };
    let ok = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const full_name = (r.full_name || '').trim();
      const email = (r.email || '').trim();
      const phone = (r.phone || '').trim();
      const address_line1 = (r.address_line1 || '').trim();
      const missing = isCustomerConsigneeComplete({ full_name, email, phone, address_line1 });
      if (missing) {
        failed++;
        errors.push(`Row ${i + 2}: ${missing} (Consignee Name, Contact, Email, Address required)`);
        continue;
      }
      const customer_type = (r.customer_type || 'individual').trim().toLowerCase();
      const status = (r.status || 'lead').trim().toLowerCase();
      if (!TYPES.has(customer_type)) {
        failed++;
        errors.push(`Row ${i + 2}: customer_type must be individual or company`);
        continue;
      }
      if (!STATUSES.has(status)) {
        failed++;
        errors.push(`Row ${i + 2}: status must be lead, active, inactive, or blocked`);
        continue;
      }
      const { error } = await supabase.from('customers').insert({
        full_name,
        company_name: r.company_name?.trim() || null,
        customer_type,
        email,
        phone,
        whatsapp: r.whatsapp?.trim() || null,
        address_line1,
        country: r.country?.trim() || null,
        city: r.city?.trim() || null,
        source: r.source?.trim() || 'import',
        status,
        notes: r.notes?.trim() || null,
        assigned_to: profile.id,
        created_by: profile.id,
      });
      if (error) {
        failed++;
        errors.push(`Row ${i + 2}: ${customerContactErrorMessage(error)}`);
      } else {
        ok++;
      }
    }

    if (ok > 0) {
      toast.success(`Imported ${ok} customer(s)`);
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
        title="Bulk import customers"
        headers={CUSTOMER_CSV_HEADERS}
        sampleRow={CUSTOMER_CSV_SAMPLE}
        templateFilename="jct-customers-template.csv"
        hint="Upload a CSV or Excel file of CRM contacts. Consignee Name (full_name), Contact (phone), Email, and Address (address_line1) are required. Phone and email must be unique."
        onImport={handleImport}
      />
    </>
  );
}
