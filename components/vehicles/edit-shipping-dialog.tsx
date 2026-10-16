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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';
import {
  DOC_KIND_LABELS,
  emptyShippingForm,
  shippingFormFromVehicle,
  shippingPayloadFromForm,
  type VehicleDocKind,
  type VehicleFreightMode,
} from '@/lib/vehicle-lifecycle';

const SHIPPING_UPLOADS: { kind: VehicleDocKind; label: string }[] = [
  { kind: 'bl', label: 'BL' },
  { kind: 'amend_bl', label: 'Amend BL' },
  { kind: 'surrender', label: DOC_KIND_LABELS.surrender },
  { kind: 'draft', label: DOC_KIND_LABELS.draft },
  { kind: 'waybill', label: DOC_KIND_LABELS.waybill },
  { kind: 'shipping_invoice', label: DOC_KIND_LABELS.shipping_invoice },
  { kind: 'other', label: DOC_KIND_LABELS.other },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSaved: () => void | Promise<void>;
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium leading-snug">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function EditShippingDialog({ open, onOpenChange, vehicle, onSaved }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState(emptyShippingForm);
  const [files, setFiles] = useState<Partial<Record<VehicleDocKind, File | null>>>({});
  const [existing, setExisting] = useState<AttachmentListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<AttachmentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reloadExisting = async () => {
    if (!vehicle) return;
    const rows = await listRecordAttachments('vehicles', vehicle.id, {
      docKinds: SHIPPING_UPLOADS.map((u) => u.kind),
    });
    setExisting(rows);
  };

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm(shippingFormFromVehicle(vehicle));
    setFiles({});
    setPendingDelete(null);
    void reloadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens for this vehicle
  }, [open, vehicle]);

  const reset = () => {
    if (!vehicle) return;
    setForm(shippingFormFromVehicle(vehicle));
    setFiles({});
  };

  const set = <K extends keyof typeof emptyShippingForm>(key: K, value: (typeof emptyShippingForm)[K]) => {
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
    if (
      !form.shipping_line.trim() ||
      !form.shipping_vessel_name.trim() ||
      !form.shipping_voyage_number.trim() ||
      !form.shipping_etd ||
      !form.shipping_eta ||
      !form.shipping_port_of_loading.trim() ||
      !form.shipping_place_of_delivery.trim() ||
      !form.shipping_cut_off_date ||
      !form.shipping_booking_number.trim()
    ) {
      toast.error('Fill all required shipping fields');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .update({
        ...shippingPayloadFromForm(form),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id);

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    for (const { kind } of SHIPPING_UPLOADS) {
      const file = files[kind];
      if (!file) continue;
      const ok = await uploadRecordAttachment('vehicles', vehicle.id, file, profile.id, { docKind: kind });
      if (!ok) {
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    toast.success('Shipping info updated');
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Shipping Info</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Ship Company - 船舶会社" required>
              <Input value={form.shipping_line} onChange={(e) => set('shipping_line', e.target.value)} />
            </Field>
            <Field label="Vessel Name - 船名" required>
              <Input value={form.shipping_vessel_name} onChange={(e) => set('shipping_vessel_name', e.target.value)} />
            </Field>
            <Field label="Voyage Number - 航海番号" required>
              <Input value={form.shipping_voyage_number} onChange={(e) => set('shipping_voyage_number', e.target.value)} />
            </Field>
            <Field label="Ship Estimated Departure - 船の出発予定時刻" required>
              <Input type="date" value={form.shipping_etd} onChange={(e) => set('shipping_etd', e.target.value)} />
            </Field>

            <Field label="Ship Estimated Arrival - 船の到着予定日" required>
              <Input type="date" value={form.shipping_eta} onChange={(e) => set('shipping_eta', e.target.value)} />
            </Field>
            <Field label="Port Of Loading - 積荷港" required>
              <Input
                value={form.shipping_port_of_loading}
                onChange={(e) => set('shipping_port_of_loading', e.target.value)}
              />
            </Field>
            <Field label="Place Of Delivery - 納入場所" required>
              <Input
                value={form.shipping_place_of_delivery}
                onChange={(e) => set('shipping_place_of_delivery', e.target.value)}
              />
            </Field>
            <Field label="Forwarding Agent - 運送業者">
              <Input
                value={form.shipping_forwarding_agent}
                onChange={(e) => set('shipping_forwarding_agent', e.target.value)}
              />
            </Field>

            <Field label="Ship Cut Off Date - 出荷締切日" required>
              <Input
                type="date"
                value={form.shipping_cut_off_date}
                onChange={(e) => set('shipping_cut_off_date', e.target.value)}
              />
            </Field>
            <Field label="BL #">
              <Input value={form.shipping_bl_number} onChange={(e) => set('shipping_bl_number', e.target.value)} />
            </Field>
            <Field label="Booking Number - 予約番号" required>
              <Input
                value={form.shipping_booking_number}
                onChange={(e) => set('shipping_booking_number', e.target.value)}
              />
            </Field>
            <Field label="Track URL - トラックURL">
              <Input value={form.shipping_track_url} onChange={(e) => set('shipping_track_url', e.target.value)} />
            </Field>

            <Field label="BL Date - BL日付">
              <Input type="date" value={form.shipping_bl_date} onChange={(e) => set('shipping_bl_date', e.target.value)} />
            </Field>
            <Field label="Shipment Type - 発送タイプ">
              <Select
                value={form.freight_mode || 'none'}
                onValueChange={(v) => set('freight_mode', v === 'none' ? '' : (v as VehicleFreightMode))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  <SelectItem value="container">CONTAINER 40FT</SelectItem>
                  <SelectItem value="roro">RORO</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Container # - コンテナ">
              <Input
                value={form.shipping_container_number}
                onChange={(e) => set('shipping_container_number', e.target.value)}
              />
            </Field>
            <Field label="Freight Charges - 運賃">
              <Input
                type="number"
                value={form.shipping_freight_charges}
                onChange={(e) => set('shipping_freight_charges', e.target.value)}
              />
            </Field>

            <Field label="Vanning Charges - バンニング料金">
              <Input
                type="number"
                value={form.shipping_vanning_charges}
                onChange={(e) => set('shipping_vanning_charges', e.target.value)}
              />
            </Field>
            <Field label="Ship Invoice Details - 発送請求書の詳細">
              <Textarea
                rows={2}
                value={form.shipping_notes}
                onChange={(e) => set('shipping_notes', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SHIPPING_UPLOADS.map(({ kind, label }) => (
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
