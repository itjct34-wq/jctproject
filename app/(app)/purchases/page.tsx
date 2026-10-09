'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Auction Purchases" description="Purchase orders, cost breakdowns, and supplier payment tracking" />
      <Card className="border-border/60">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
              <Construction className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Coming in Phase 2</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Purchase management will include purchase orders, cost breakdowns (auction fees, transport, inspection), approval limits, and supplier payment tracking.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
