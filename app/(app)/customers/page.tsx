'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Customers / CRM" description="Manage customer profiles, enquiries, and communication history" />
      <Card className="border-border/60">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
              <Construction className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Coming in Phase 2</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              The Customer CRM module will be built with full database integration, RLS policies, customer timelines, vehicle requirements tracking, and import/export tools.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
