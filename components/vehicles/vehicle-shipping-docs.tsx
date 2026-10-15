'use client';

import { RecordAttachments } from '@/components/shared/record-attachments';

/** Vehicle attachments list (view + delete). Uploads live in Edit Shipping / Edit Courier. */
export function VehicleShippingDocs({
  vehicleId,
  allowDelete,
  emptyLabel,
  onChanged,
}: {
  vehicleId: string;
  /** Who can edit shipping / vehicle — gates delete. */
  allowDelete: boolean;
  /** Compact empty copy (e.g. Documents tab: "No documents."). */
  emptyLabel?: string;
  onChanged?: () => void;
}) {
  return (
    <RecordAttachments
      entityType="vehicles"
      entityId={vehicleId}
      allowUpload={false}
      allowDelete={allowDelete}
      embedded
      emptyLabel={emptyLabel}
      onChanged={onChanged}
    />
  );
}
