'use client';

import { RemittanceCrumb } from '@/components/payments/remittance-crumb';
import { RemittanceForm } from '@/components/payments/remittance-form';
import { usePermissions } from '@/hooks/use-permissions';

export default function AddRemittancePage() {
  const { can } = usePermissions();
  if (!can('payments', 'create')) {
    return <p className="p-8 text-sm text-muted-foreground">You do not have permission to add remittances.</p>;
  }
  return (
    <div>
      <RemittanceCrumb current="Add" />
      <RemittanceForm />
    </div>
  );
}
