'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { usePermissions } from '@/hooks/use-permissions';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';
import { filterRemittancesByDateRange } from '@/lib/remittance';
import { supabase } from '@/lib/supabase/client';
import type { Payment, PaymentAllocation } from '@/lib/types';
import { toast } from 'sonner';

const RemittanceInsights = dynamic(
  () =>
    import('@/components/payments/remittance-insights').then((m) => m.RemittanceInsights),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading charts…
      </div>
    ),
  }
);

type InsightPayment = Payment & {
  payment_allocations?: Pick<PaymentAllocation, 'allocate_amount'>[] | null;
};

export default function RemittanceInsightsPage() {
  const { can } = usePermissions();
  const canView = can('payments', 'view');
  const [rows, setRows] = useState<InsightPayment[]>([]);
  const [officeNames, setOfficeNames] = useState<Record<string, string>>({});
  const [shiftNames, setShiftNames] = useState<Record<string, string>>({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const nested = await supabase
      .from('payments')
      .select('*, payment_allocations(allocate_amount)')
      .order('created_at', { ascending: false })
      .limit(ERP_LIST_LIMIT);

    if (nested.error) {
      const flat = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(ERP_LIST_LIMIT);
      if (flat.error) {
        toast.error(`Unable to load remittances: ${nested.error.message}`);
        setRows([]);
      } else {
        const pays = (flat.data || []) as InsightPayment[];
        const ids = pays.map((p) => p.id);
        const { data: allocs } = ids.length
          ? await supabase
              .from('payment_allocations')
              .select('payment_id, allocate_amount')
              .in('payment_id', ids)
          : { data: [] as Array<{ payment_id: string; allocate_amount: number }> };
        const byPay = new Map<string, Pick<PaymentAllocation, 'allocate_amount'>[]>();
        for (const a of allocs || []) {
          const list = byPay.get(a.payment_id) || [];
          list.push({ allocate_amount: a.allocate_amount });
          byPay.set(a.payment_id, list);
        }
        setRows(
          pays.map((p) => ({
            ...p,
            payment_allocations: byPay.get(p.id) || [],
          })),
        );
      }
    } else {
      setRows((nested.data || []) as InsightPayment[]);
    }

    const [{ data: offices }, { data: shifts }] = await Promise.all([
      supabase.from('offices').select('id, name, code').order('name').limit(200),
      supabase.from('shifts').select('id, name, code').order('name').limit(200),
    ]);
    const officeMap: Record<string, string> = {};
    for (const o of offices || []) {
      officeMap[o.id] = (o.name || o.code || o.id).trim();
    }
    setOfficeNames(officeMap);
    const shiftMap: Record<string, string> = {};
    for (const s of shifts || []) {
      shiftMap[s.id] = (s.name || s.code || s.id).trim();
    }
    setShiftNames(shiftMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadData();
  }, [canView, loadData]);

  const insightsPayments = useMemo(
    () => filterRemittancesByDateRange(rows, from, to),
    [rows, from, to],
  );

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Remittance insights" description="Currency mix, allocation KPIs, and office volume." />
        <p className="text-sm text-muted-foreground">You do not have permission to view remittance insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remittance insights"
        description="Per-currency ledgers, allocation mix, and office volume — amounts stay in their own currency."
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading insights…
        </div>
      ) : (
        <RemittanceInsights
          payments={insightsPayments}
          officeNames={officeNames}
          shiftNames={shiftNames}
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onResetRange={() => {
            setFrom('');
            setTo('');
          }}
        />
      )}
    </div>
  );
}
