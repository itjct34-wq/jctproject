'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import {
  deleteRecordAttachment,
  listRecordAttachments,
  openRecordAttachmentInNewTab,
  uploadRecordAttachment,
  type AttachmentListItem,
} from '@/components/shared/record-attachments';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';
import {
  COURIER_SELECTION_OPTIONS,
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
      <Label className="leading-snug">{label}</Label>
      {children}
    </div>
  );
}

export function EditCourierDialog({ open, onOpenChange, vehicle, onSaved }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyCourierForm);
  const [files, setFiles] = useState<Partial<Record<VehicleDocKind, File | null>>>({});
  const [existing, setExisting] = useState<AttachmentListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reloadExisting = async () => {
    if (!vehicle) return;
    const rows = await listRecordAttachments('vehicles', vehicle.id, {
      docKinds: COURIER_UPLOADS.map((u) => u.kind),
    });
    setExisting(rows);
  };

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm(courierFormFromVehicle(vehicle));
    setFiles({});
    setPendingDelete(null);
    void reloadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens for this vehicle
  }, [open, vehicle]);

  const reset = () => {
    if (!vehicle) return;
    setForm(courierFormFromVehicle(vehicle));
    setFiles({});
  };

  const set = <K extends keyof typeof emptyCourierForm>(key: K, value: (typeof emptyCourierForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await deleteRecordAttachment(pendingDelete.id, pendingDelete.object_path);
    setDeleting(false);
    if (!ok) return;
    setPendingDelete(null);
    toast.success('Attachment deleted');
    await reloadExisting();
    await onSaved();
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
                <div
                  key={row.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-1 pl-2 pr-1 text-xs"
                >
                  <button
                    type="button"
                    className="inline-flex min-w-0 items-center gap-1.5 hover:opacity-80"
                    onClick={() => void openRecordAttachmentInNewTab(row.object_path)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    <span className="font-medium uppercase">{row.doc_kind || 'file'}</span>
                    <span className="max-w-[10rem] truncate text-muted-foreground">{row.file_name}</span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Delete ${row.file_name}`}
                    disabled={deleting}
                    onClick={() => setPendingDelete(row)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

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

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(openAlert) => {
          if (!openAlert && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  <span className="block font-medium text-foreground">{pendingDelete.file_name}</span>
                  <span className="mt-2 block">This removes the file from storage. This cannot be undone.</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
