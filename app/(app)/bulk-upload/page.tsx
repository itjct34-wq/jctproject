'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BulkUploadWizard } from '@/components/stock/bulk-upload-wizard';
import { usePermissions } from '@/hooks/use-permissions';
import { Loader2 } from 'lucide-react';

function BulkUploadGate() {
  const { canBulkUpload } = usePermissions();
  if (!canBulkUpload()) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        You do not have permission to use Bulk upload. Ask an admin to grant <span className="font-medium">vehicles.import</span>.
      </p>
    );
  }
  return <BulkUploadWizard />;
}

export default function BulkUploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk upload"
        description="Choose cars, machinery, parts, third-party dealership units, or auction stock. Then pick country and port, upload the easy sheet, and attach photos as a ZIP — no image URLs."
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        }
      >
        <BulkUploadGate />
      </Suspense>
    </div>
  );
}
