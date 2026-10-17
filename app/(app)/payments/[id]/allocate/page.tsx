'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { RemittanceCrumb, RequiredMark } from '@/components/payments/remittance-crumb';
import { SearchableSelect } from '@/components/payments/searchable-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import type { Payment, PaymentAllocation, Vehicle } from '@/lib/types';
import { isUnknownRemittance, remittanceAmount, remittanceRemaining, vehicleSoldPrice } from '@/lib/remittance';
import { formatMoney } from '@/lib/utils/format';
import { toast } from 'sonner';

type Stock = Pick<
  Vehicle,
  'id' | 'stock_number' | 'chassis_number' | 'make' | 'model' | 'customer_id' | 'sold_price' | 'fob_usd' | 'listed_price' | 'payment_status'
>;

type Line = {
  key: string;
  vehicle_id: string;
  allocate_amount: string;
};

function newLine(): Line {
  return { key: crypto.randomUUID(), vehicle_id: '', allocate_amount: '' };
}

export default function AllocateRemittancePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { canAllocateRemittances } = usePermissions();
  const canAllocate = canAllocateRemittances();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [existing, setExisting] = useState<PaymentAllocation[]>([]);
  const [vehicles, setVehicles] = useState<Stock[]>([]);
  const [otherAlloc, setOtherAlloc] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, aRes, vRes] = await Promise.all([
      supabase.from('payments').select('*').eq('id', params.id).maybeSingle(),
      supabase.from('payment_allocations').select('*').eq('payment_id', params.id),
      supabase
        .from('vehicles')
        .select('id, stock_number, chassis_number, make, model, customer_id, sold_price, fob_usd, listed_price, payment_status')
        .order('stock_number')
        .limit(800),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    const pay = (pRes.data || null) as Payment | null;
    setPayment(pay);
    const allocs = (aRes.data || []) as PaymentAllocation[];
    setExisting(allocs);
    setVehicles((vRes.data || []) as Stock[]);
    if (allocs.length) {
      setLines(
        allocs.map((a) => ({
          key: a.id,
          vehicle_id: a.vehicle_id,
          allocate_amount: String(a.allocate_amount),
        })),
      );
    } else {
      const remaining = pay ? remittanceAmount(pay) : 0;
      setLines([{ ...newLine(), allocate_amount: remaining ? String(remaining) : '' }]);
    }
    const vehicleIds = ((vRes.data || []) as Stock[]).map((v) => v.id);
    if (vehicleIds.length) {
      const { data: allAlloc } = await supabase
        .from('payment_allocations')
        .select('vehicle_id, allocate_amount, payment_id')
        .in('vehicle_id', vehicleIds);
      const map: Record<string, number> = {};
      for (const row of allAlloc || []) {
        if (row.payment_id === params.id) continue;
        map[row.vehicle_id] = (map[row.vehicle_id] || 0) + (Number(row.allocate_amount) || 0);
      }
      setOtherAlloc(map);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stockById = useMemo(() => {
    const map = new Map<string, Stock>();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  const preferredVehicles = useMemo(() => {
    if (!payment?.customer_id) return vehicles;
    const mine = vehicles.filter((v) => v.customer_id === payment.customer_id);
    const rest = vehicles.filter((v) => v.customer_id !== payment.customer_id);
    return [...mine, ...rest];
  }, [vehicles, payment?.customer_id]);

  const stockOptions = preferredVehicles.map((v) => ({
    value: v.id,
    label: v.stock_number,
    keywords: `${v.chassis_number} ${v.make} ${v.model}`,
  }));
  const chassisOptions = preferredVehicles.map((v) => ({
    value: v.id,
    label: v.chassis_number,
    keywords: `${v.stock_number} ${v.make} ${v.model}`,
  }));

  const draftAllocs = lines
    .filter((l) => l.vehicle_id && Number(l.allocate_amount) > 0)
    .map((l) => ({ allocate_amount: Number(l.allocate_amount) }));
  const totalAvailable = payment ? remittanceAmount(payment) : 0;
  const remaining = payment ? remittanceRemaining(payment, draftAllocs) : 0;

  const setLine = (key: string, patch: Partial<Line>) => {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || !profile || !canAllocate) return;
    if (isUnknownRemittance(payment) || !payment.customer_id) {
      toast.error('Tag customer and sales agent before allocating to stock');
      return;
    }
    const ready = lines.filter((l) => l.vehicle_id);
    if (!ready.length) {
      toast.error('Add at least one stock line');
      return;
    }
    for (const line of ready) {
      if (!(Number(line.allocate_amount) > 0)) {
        toast.error('Allocate amount is required on every stock line');
        return;
      }
    }
    const ids = ready.map((l) => l.vehicle_id);
    if (new Set(ids).size !== ids.length) {
      toast.error('Each stock can only appear once');
      return;
    }
    const sum = ready.reduce((s, l) => s + Number(l.allocate_amount), 0);
    if (sum - totalAvailable > 0.009) {
      toast.error('Allocation exceeds remittance remaining');
      return;
    }
    setSubmitting(true);
    const existingByVehicle = new Map(existing.map((a) => [a.vehicle_id, a]));
    const keepIds = new Set(ready.map((l) => l.vehicle_id));
    const toRemove = existing.filter((a) => !keepIds.has(a.vehicle_id));
    if (toRemove.length) {
      const { error: delErr } = await supabase
        .from('payment_allocations')
        .delete()
        .in(
          'id',
          toRemove.map((a) => a.id),
        );
      if (delErr) {
        setSubmitting(false);
        toast.error(delErr.message);
        return;
      }
    }
    const toUpdate = ready.filter((l) => existingByVehicle.has(l.vehicle_id));
    const toInsert = ready.filter((l) => !existingByVehicle.has(l.vehicle_id));
    for (const line of toUpdate) {
      const prev = existingByVehicle.get(line.vehicle_id)!;
      const v = stockById.get(line.vehicle_id);
      const nextAmt = Number(line.allocate_amount);
      const nextSold = v ? vehicleSoldPrice(v) : null;
      if (Number(prev.allocate_amount) === nextAmt && (prev.sold_price ?? null) === nextSold) continue;
      const { error: updErr } = await supabase
        .from('payment_allocations')
        .update({ allocate_amount: nextAmt, sold_price: nextSold })
        .eq('id', prev.id);
      if (updErr) {
        setSubmitting(false);
        toast.error(`Could not update allocation: ${updErr.message}`);
        return;
      }
    }
    if (toInsert.length) {
      const { error } = await supabase.from('payment_allocations').insert(
        toInsert.map((line) => {
          const v = stockById.get(line.vehicle_id);
          return {
            payment_id: payment.id,
            vehicle_id: line.vehicle_id,
            allocate_amount: Number(line.allocate_amount),
            sold_price: v ? vehicleSoldPrice(v) : null,
            created_by: profile.id,
          };
        }),
      );
      if (error) {
        setSubmitting(false);
        toast.error(`Could not allocate: ${error.message}`);
        return;
      }
    }
    setSubmitting(false);
    toast.success(sum >= totalAvailable - 0.009 ? 'Remittance allocated' : 'Partial allocation saved');
    router.push('/payments');
    router.refresh();
  };

  if (!canAllocate) {
    return <p className="p-8 text-sm text-muted-foreground">You do not have permission to allocate remittances.</p>;
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading allocation...
      </div>
    );
  }
  if (!payment) {
    return <p className="p-8 text-sm text-muted-foreground">Remittance not found.</p>;
  }

  if (isUnknownRemittance(payment) || !payment.customer_id) {
    return (
      <div className="space-y-4 p-8">
        <RemittanceCrumb current="Allocate" />
        <p className="text-sm text-muted-foreground">
          This is an Unknown TT. Tag customer and sales agent on Remittances before allocating to stock.
        </p>
        <Button type="button" variant="outline" onClick={() => router.push('/payments?tab=unknown')}>
          Back to Unknown TT
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RemittanceCrumb current="Allocate" />
      <form onSubmit={submit} className="space-y-6">
        <div className="max-w-sm space-y-1.5">
          <Label>
            Allocate To
            <RequiredMark />
          </Label>
          <Input value="Stock" readOnly className="bg-muted" />
        </div>
        <Card className="border-border/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h2 className="text-lg font-semibold text-primary">Allocate To Stocks</h2>
              <Button type="button" size="sm" className="mt-3" onClick={() => setLines((rows) => [...rows, newLine()])}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add More
              </Button>
            </div>
            <div className="text-right text-sm">
              <p>
                Total Available:{' '}
                <span className="font-semibold text-primary">{formatMoney(totalAvailable, payment.currency)}</span>
              </p>
              <p>
                Remaining:{' '}
                <span className={remaining <= 0.009 ? 'font-semibold text-emerald-700' : 'font-semibold text-primary'}>
                  {formatMoney(remaining, payment.currency)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        {lines.map((line) => {
          const v = stockById.get(line.vehicle_id);
          const sold = v ? vehicleSoldPrice(v) : 0;
          const thisAmt = Number(line.allocate_amount) || 0;
          const already = (otherAlloc[line.vehicle_id] || 0) + thisAmt;
          const balance = v ? Math.round((sold - already) * 100) / 100 : 0;
          return (
            <div key={line.key} className="relative grid gap-3 rounded-xl border border-border/60 bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove allocation line"
                  className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Remove this stock line"
                  onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="space-y-1.5">
                <Label>
                  Stock ID
                  <RequiredMark />
                </Label>
                <SearchableSelect
                  value={line.vehicle_id}
                  onChange={(vehicle_id) => {
                    const next = stockById.get(vehicle_id);
                    const due = next ? vehicleSoldPrice(next) : 0;
                    const leftover = remittanceRemaining(
                      payment,
                      lines
                        .filter((l) => l.key !== line.key)
                        .filter((l) => l.vehicle_id && Number(l.allocate_amount) > 0)
                        .map((l) => ({ allocate_amount: Number(l.allocate_amount) })),
                    );
                    const suggest = due > 0 ? Math.min(due, leftover) : leftover;
                    setLine(line.key, {
                      vehicle_id,
                      allocate_amount: line.allocate_amount || (suggest ? String(suggest) : ''),
                    });
                  }}
                  options={stockOptions}
                  placeholder="Search stock ID"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chassis No.</Label>
                <SearchableSelect
                  value={line.vehicle_id}
                  onChange={(vehicle_id) => setLine(line.key, { vehicle_id })}
                  options={chassisOptions}
                  placeholder="Search chassis no."
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Allocate Amount
                  <RequiredMark />
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.allocate_amount}
                  onChange={(e) => setLine(line.key, { allocate_amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sold Price</Label>
                <Input value={v ? String(sold) : ''} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Balance Amount</Label>
                <Input value={v ? String(balance) : ''} readOnly className="bg-muted" />
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={() => void load()}>
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Allocate'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
