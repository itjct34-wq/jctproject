'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import {
  listRecordAttachments,
  openRecordAttachmentInNewTab,
  uploadRecordAttachment,
  type AttachmentListItem,
} from '@/components/shared/record-attachments';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';
import {
  COURIER_SELECTION_OPTIONS,
  DOC_KIND_LABELS,
  courierFormFromVehicle,
  courierPayloadFromForm,
  emptyCourierForm,
  type VehicleDocKind,
} from '@/lib/vehicle-lifecycle';

const COURIER_UPLOADS: { kind: VehicleDocKind; label: string }[] = [
  { kind: 'export_certificate', label: 'Export Certificate - 輸出証明書' },
  { kind: 'export_certificate_en', label: 'Export Certificate (English version) - 輸出証明書 (英語版)' },
  { kind: 'inspection', label: 'Inspection Certificate - 検査証明書' },
  { kind: 'auction_sheet', label: 'Auction Sheet - オークションシート' },
  { kind: 'bl', label: 'BL' },
  { kind: 'spare_key', label: 'Spare Key - スペアキー' },
  { kind: 'other', label: 'Other Documents - その他の文書' },
  { kind: 'dhl', label: 'DHL Documents - DHL ドキュメント' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSaved: () => void | Promise<void>;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium leading-snug">{label}</Label>
      {children}
    </div>
  );
}

export function EditCourierDialog({ open, onOpenChange, vehicle, onSaved }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyCourierForm);
  const [files, setFiles] = useState<Partial<Record<VehicleDocKind, File | null>>>({});
  const [existing, setExisting] = useState<AttachmentListItem[]>([]);
  const [notify, setNotify] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm(courierFormFromVehicle(vehicle));
    setFiles({});
    setNotify(false);
    void listRecordAttachments('vehicles', vehicle.id, {
      docKinds: COURIER_UPLOADS.map((u) => u.kind),
    }).then(setExisting);
  }, [open, vehicle]);

  const reset = () => {
    if (!vehicle) return;
    setForm(courierFormFromVehicle(vehicle));
    setFiles({});
    setNotify(false);
  };

  const set = <K extends keyof typeof emptyCourierForm>(key: K, value: (typeof emptyCourierForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle || !profile) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('vehicles')
      .update({
        ...courierPayloadFromForm(form),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id);

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    for (const { kind } of COURIER_UPLOADS) {
      const file = files[kind];
      if (!file) continue;
      const ok = await uploadRecordAttachment('vehicles', vehicle.id, file, profile.id, { docKind: kind });
      if (!ok) {
        setSubmitting(false);
        return;
      }
    }

    if (notify && vehicle.reserved_by) {
      await supabase.from('notifications').insert({
        user_id: vehicle.reserved_by,
        title: 'Courier / documents updated',
        message: `${vehicle.stock_number}: tracking or certificates were updated.`,
        type: 'info',
        related_module: 'vehicles',
        related_id: vehicle.id,
        is_read: false,
      });
    }

    setSubmitting(false);
    toast.success('Courier info updated');
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Courier Info</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Courier Selection - 宅配業者の選択">
              <Select
                value={form.courier_selection || 'none'}
                onValueChange={(v) => set('courier_selection', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {COURIER_SELECTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Courier Company - 宅配会社">
              <Input value={form.courier_company} onChange={(e) => set('courier_company', e.target.value)} />
            </Field>
            <Field label="Tracking ID - トラッキングID">
              <Input value={form.courier_tracking_id} onChange={(e) => set('courier_tracking_id', e.target.value)} />
            </Field>
            <Field label="Courier Date - 宅配便の日付">
              <Input type="date" value={form.courier_date} onChange={(e) => set('courier_date', e.target.value)} />
            </Field>

            <Field label="Courier Details - 宅配便の詳細">
              <Input value={form.courier_details} onChange={(e) => set('courier_details', e.target.value)} />
            </Field>
            <Field label="Courier Charges - 宅配料金">
              <Input
                type="number"
                value={form.courier_charges}
                onChange={(e) => set('courier_charges', e.target.value)}
              />
            </Field>

            {COURIER_UPLOADS.map(({ kind, label }) => (
              <Field key={kind} label={label}>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setFiles((prev) => ({ ...prev, [kind]: file }));
                  }}
                />
              </Field>
            ))}
          </div>

          {existing.length ? (
            <div className="flex flex-wrap gap-2">
              {existing.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => void openRecordAttachmentInNewTab(row.object_path)}
                >
                  <FileText className="h-3.5 w-3.5 text-red-600" />
                  <span className="font-medium uppercase">{row.doc_kind || 'file'}</span>
                  <span className="max-w-[10rem] truncate text-muted-foreground">{row.file_name}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3">
            <label className="flex items-start gap-2 text-sm font-medium">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
              <span>Notify the customer in the app</span>
            </label>
            <p className="pl-6 text-xs text-muted-foreground">
              If you added the tracking number or a certificate: the buyer is told (certificates only if they have paid
              in full). Leave it unticked when you are correcting a mistake.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>
              Reset
            </Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
