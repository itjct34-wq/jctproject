'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Proforma, commercial, and purchase invoices with PDF generation" />
      <Card className="border-border/60">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
              <Construction className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Coming in Phase 3</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Invoicing will include proforma and commercial invoices, credit notes, configurable numbering, PDF generation, and complete revision history.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
