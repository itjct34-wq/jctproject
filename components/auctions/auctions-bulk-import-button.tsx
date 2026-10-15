'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export function AuctionsBulkImportButton() {
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href="/bulk-upload?kind=auctions">
        <Upload className="mr-1.5 h-4 w-4" />
        Bulk upload
      </Link>
    </Button>
  );
}
