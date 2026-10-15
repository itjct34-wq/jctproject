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
  const [notify, setNotify] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm(shippingFormFromVehicle(vehicle));
    setFiles({});
    setNotify(false);
    void listRecordAttachments('vehicles', vehicle.id, {
      docKinds: SHIPPING_UPLOADS.map((u) => u.kind),
    }).then(setExisting);
  }, [open, vehicle]);

  const reset = () => {
    if (!vehicle) return;
    setForm(shippingFormFromVehicle(vehicle));
    setFiles({});
    setNotify(false);
  };

  const set = <K extends keyof typeof emptyShippingForm>(key: K, value: (typeof emptyShippingForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

    if (notify && vehicle.reserved_by) {
      await supabase.from('notifications').insert({
        user_id: vehicle.reserved_by,
        title: 'Shipping updated',
        message: `${vehicle.stock_number}: vessel / ETD / ETA / booking or documents were updated.`,
        type: 'info',
        related_module: 'vehicles',
        related_id: vehicle.id,
        is_read: false,
      });
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
        <form onSubmit={submit} className="space-y-4">
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
              If you changed the vessel, voyage, ETD, ETA or container, or uploaded a B/L, waybill or surrender, the
              buyer is told (documents only if they are allowed to see them). Leave it unticked when you are correcting
              a mistake.
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
