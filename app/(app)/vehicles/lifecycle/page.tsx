'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { LifecycleBoard } from '@/components/vehicles/lifecycle-board';
import { supabase } from '@/lib/supabase/client';
import {
  buildLifecycleSnapshot,
  type LifecycleVehicleRow,
} from '@/lib/vehicles/lifecycle-metrics';
import { toast } from 'sonner';

export default function VehiclesLifecyclePage() {
  const [rows, setRows] = useState<LifecycleVehicleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vehicles')
      .select(
        'id, payment_status, shipping_status, status, created_at, shipping_etd, shipping_eta, shipping_bl_date, arrival_date, stock_category'
      )
      .order('updated_at', { ascending: false })
      .limit(10000);

    if (error) {
      toast.error(`Unable to load lifecycle data: ${error.message}`);
      setRows([]);
    } else {
      setRows((data || []) as LifecycleVehicleRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = useMemo(() => buildLifecycleSnapshot(rows), [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock pipeline"
        description="Payment × shipping lifecycle across inventory. Tap a KPI, column, or combo to open the stock list with that filter."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/vehicles">Open stock list</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        }
      />

      {loading && rows.length === 0 ? (
        <div className="glass-panel-strong flex items-center justify-center gap-2 rounded-xl p-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building pipeline…
        </div>
      ) : (
        <LifecycleBoard snapshot={snapshot} />
      )}
    </div>
  );
}
