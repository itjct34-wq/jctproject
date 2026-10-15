'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import type { EasySheetKind } from '@/lib/utils/csv-import';

type Props = { kind?: Exclude<EasySheetKind, 'auctions'> };

export function VehiclesBulkImportButton({ kind }: Props) {
  const href = kind && kind !== 'car' ? `/bulk-upload?kind=${kind}` : '/bulk-upload?kind=car';
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href={href}>
        <Upload className="mr-1.5 h-4 w-4" />
        Bulk upload
      </Link>
    </Button>
  );
}
