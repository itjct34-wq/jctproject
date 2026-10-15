'use client';

import { RecordAttachments } from '@/components/shared/record-attachments';

/** Vehicle attachments list (view + delete). Uploads live in Edit Shipping / Edit Courier. */
export function VehicleShippingDocs({
  vehicleId,
  allowDelete,
  onChanged,
}: {
  vehicleId: string;
  /** Who can edit shipping / vehicle — gates delete. */
  allowDelete: boolean;
  onChanged?: () => void;
}) {
  return (
    <RecordAttachments
      entityType="vehicles"
      entityId={vehicleId}
      allowUpload={false}
      allowDelete={allowDelete}
      embedded
      onChanged={onChanged}
    />
  );
}
