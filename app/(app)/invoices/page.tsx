'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { InvoicesWorkspace } from '@/components/invoices/invoices-workspace';

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      }
    >
      <InvoicesWorkspace kind="commercial" />
    </Suspense>
  );
}
