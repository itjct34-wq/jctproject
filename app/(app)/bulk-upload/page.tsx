'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BulkUploadWizard } from '@/components/stock/bulk-upload-wizard';
import { Loader2 } from 'lucide-react';

export default function BulkUploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk upload"
        description="Choose cars, machinery, parts, or auction stock. Then pick country and port, upload the easy sheet, and attach photos as a ZIP — no image URLs."
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        }
      >
        <BulkUploadWizard />
      </Suspense>
    </div>
  );
}
