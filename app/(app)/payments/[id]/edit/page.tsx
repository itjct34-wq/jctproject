'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { RemittanceCrumb } from '@/components/payments/remittance-crumb';
import { RemittanceForm } from '@/components/payments/remittance-form';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import type { Payment } from '@/lib/types';
import { toast } from 'sonner';

export default function EditRemittancePage() {
  const params = useParams<{ id: string }>();
  const { can } = usePermissions();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase
      .from('payments')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error(error.message);
        setPayment((data || null) as Payment | null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (!can('payments', 'edit')) {
    return <p className="p-8 text-sm text-muted-foreground">You do not have permission to edit remittances.</p>;
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading remittance...
      </div>
    );
  }
  if (!payment) {
    return <p className="p-8 text-sm text-muted-foreground">Remittance not found.</p>;
  }
  return (
    <div>
      <RemittanceCrumb current="Edit" />
      <RemittanceForm payment={payment} />
    </div>
  );
}
