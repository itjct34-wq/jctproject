'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RemittanceCrumb } from '@/components/payments/remittance-crumb';
import { RemittanceForm } from '@/components/payments/remittance-form';
import { usePermissions } from '@/hooks/use-permissions';

function AddRemittanceInner() {
  const searchParams = useSearchParams();
  const { canMutateRemittances, isElevatedStaff } = usePermissions();
  const unknown = searchParams.get('unknown') === '1' || searchParams.get('tab') === 'unknown';

  if (unknown && !isElevatedStaff) {
    return <p className="p-8 text-sm text-muted-foreground">Only accounts, operations, managers, and admins can add Unknown TT.</p>;
  }
  if (!unknown && !canMutateRemittances()) {
    return <p className="p-8 text-sm text-muted-foreground">You do not have permission to add remittances.</p>;
  }
  return (
    <div>
      <RemittanceCrumb current={unknown ? 'Unknown TT' : 'Add'} />
      <RemittanceForm unknown={unknown} />
    </div>
  );
}

export default function AddRemittancePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading...</p>}>
      <AddRemittanceInner />
    </Suspense>
  );
}
