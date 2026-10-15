'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function RemittanceCrumb({ current }: { current: string }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <span className="font-semibold text-primary">Remittance Management</span>
      <ChevronRight className="h-3.5 w-3.5" />
      <Link href="/payments" className="hover:text-primary hover:underline">
        Remittances
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-foreground">{current}</span>
    </nav>
  );
}

export function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}
