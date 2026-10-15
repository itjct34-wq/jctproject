'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { RecordAttachments, uploadRecordAttachment } from '@/components/shared/record-attachments';
import { DOC_KIND_LABELS, type VehicleDocKind } from '@/lib/vehicle-lifecycle';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const KINDS: { kind: Exclude<VehicleDocKind, 'other'>; hint: string }[] = [
  { kind: 'bl', hint: 'PDF · sets Shipped' },
  { kind: 'surrender', hint: 'sets Delivered' },
  { kind: 'waybill', hint: 'sets Delivered' },
];

export function VehicleShippingDocs({
  vehicleId,
  allowUpload,
  onChanged,
}: {
  vehicleId: string;
  allowUpload: boolean;
  onChanged?: () => void;
}) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadKind = async (kind: VehicleDocKind, file?: File) => {
    if (!file || !profile) return;
    if (kind === 'bl' && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bill of lading must be a PDF');
      return;
    }
    setUploading(kind);
    const ok = await uploadRecordAttachment('vehicles', vehicleId, file, profile.id, { docKind: kind });
    setUploading(null);
    if (!ok) return;
    toast.success(`${DOC_KIND_LABELS[kind]} uploaded`);
    onChanged?.();
  };

  return (
    <section className="space-y-3 rounded-xl border border-border/70 p-4">
      <div>
        <h3 className="text-sm font-semibold">Documents</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          BL → shipped. Surrender or waybill → delivered. Status updates automatically.
        </p>
      </div>
      {allowUpload ? (
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ kind, hint }) => (
            <label key={kind} className="inline-flex cursor-pointer items-center">
              <input
                ref={(el) => { inputs.current[kind] = el; }}
                type="file"
                className="sr-only"
                accept={kind === 'bl' ? 'application/pdf,.pdf' : '.pdf,.jpg,.jpeg,.png,.webp'}
                disabled={Boolean(uploading)}
                onChange={(e) => {
                  void uploadKind(kind, e.target.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
              <span className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium">
                {uploading === kind ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {DOC_KIND_LABELS[kind]}
                <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <RecordAttachments entityType="vehicles" entityId={vehicleId} allowUpload={false} embedded />
    </section>
  );
}
