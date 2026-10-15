'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Payment, PaymentAllocation, Profile } from '@/lib/types';
import { paymentDisplayId, remittanceAmount, remittanceInstructed, remittanceRemaining } from '@/lib/remittance';
import { formatMoney } from '@/lib/utils/format';
import { toast } from 'sonner';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';

type AllocRow = PaymentAllocation & { vehicles?: { stock_number: string } | null };
type PaymentRow = Payment & {
  customers?: Pick<Customer, 'id' | 'customer_code' | 'full_name' | 'phone' | 'assigned_to'> | null;
  payment_allocations?: AllocRow[] | null;
};

function isoDay(value: string | null | undefined) {
  if (!value) return '—';
  const day = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return day[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd');
}

export default function RemittancesPage() {
  const { can, hasRole, isSellingFocused } = usePermissions();
  const canCreate = can('payments', 'create');
  const canEdit = can('payments', 'edit');
  const canDelete = can('payments', 'delete') || hasRole('accounts');
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const nested = await supabase
      .from('payments')
      .select(
        '*, customers(id, customer_code, full_name, phone, assigned_to), payment_allocations(id, payment_id, vehicle_id, allocate_amount, sold_price, vehicles(stock_number))',
      )
      .order('created_at', { ascending: false })
      .limit(ERP_LIST_LIMIT);
    if (nested.error) {
      const flat = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(ERP_LIST_LIMIT);
      if (flat.error) {
        toast.error(`Unable to load remittances: ${nested.error.message}`);
        setRows([]);
      } else {
        const pays = (flat.data || []) as PaymentRow[];
        const ids = pays.map((p) => p.id);
        const customerIds = [...new Set(pays.map((p) => p.customer_id).filter(Boolean))] as string[];
        const [{ data: allocs }, { data: custs }] = await Promise.all([
          ids.length
            ? supabase
                .from('payment_allocations')
                .select('id, payment_id, vehicle_id, allocate_amount, sold_price, vehicles(stock_number)')
                .in('payment_id', ids)
            : Promise.resolve({ data: [] as AllocRow[] }),
          customerIds.length
            ? supabase.from('customers').select('id, customer_code, full_name, phone, assigned_to').in('id', customerIds)
            : Promise.resolve({ data: [] }),
        ]);
        const byPay = new Map<string, AllocRow[]>();
        for (const a of (allocs || []) as AllocRow[]) {
          const list = byPay.get(a.payment_id) || [];
          list.push(a);
          byPay.set(a.payment_id, list);
        }
        const byCust = new Map(
          ((custs || []) as NonNullable<PaymentRow['customers']>[]).map((c) => [c.id, c]),
        );
        setRows(
          pays.map((p) => ({
            ...p,
            customers: p.customer_id ? byCust.get(p.customer_id) || null : null,
            payment_allocations: byPay.get(p.id) || [],
          })),
        );
      }
    } else {
      setRows((nested.data || []) as PaymentRow[]);
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, display_name')
      .limit(250);
    const map: Record<string, string> = {};
    for (const p of (profiles || []) as Pick<Profile, 'id' | 'full_name' | 'display_name'>[]) {
      map[p.id] = p.full_name?.trim() || p.display_name?.trim() || '';
    }
    setAgents(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      const alloc = p.allocation_status || 'unallocated';
      const matchesStatus = statusFilter === 'all' || alloc === statusFilter;
      const cust = p.customers;
      const hay = [
        p.payment_code,
        p.remitter_name,
        p.bank_name,
        cust?.full_name,
        cust?.customer_code,
        cust?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!q || hay.includes(q));
    });
  }, [rows, search, statusFilter]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    const { error } = await supabase.from('payments').delete().eq('id', deleteId);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    toast.success('Remittance deleted');
    setDeleteId(null);
    void loadData();
  };

  const stats = {
    total: rows.length,
    unallocated: rows.filter((p) => (p.allocation_status || 'unallocated') !== 'allocated').length,
    allocated: rows.filter((p) => p.allocation_status === 'allocated').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remittance Management"
        description={
          isSellingFocused
            ? 'T/T remittances for your customers — create, allocate to stock, or edit'
            : 'Record bank remittances and allocate them to stock'
        }
        actions={
          canCreate ? (
            <Button size="sm" asChild>
              <Link href="/payments/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Add remittance
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { label: 'Total remittances', value: stats.total },
          { label: 'Unallocated', value: stats.unallocated },
          { label: 'Allocated', value: stats.allocated },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-primary">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search remitter, customer, code..."
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unallocated">Unallocated</SelectItem>
                <SelectItem value="allocated">Allocated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading remittances...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center text-sm text-muted-foreground">
            {isSellingFocused ? 'No remittances for your customers yet.' : 'No remittances found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr className="text-[11px] uppercase tracking-wide">
                  <th className="px-3 py-2.5 font-semibold">ID</th>
                  <th className="px-3 py-2.5 font-semibold">Customer details</th>
                  <th className="px-3 py-2.5 font-semibold">Remitter details</th>
                  <th className="px-3 py-2.5 font-semibold">Remittance details</th>
                  <th className="px-3 py-2.5 font-semibold">Allocated stock IDs</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Details</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filtered.map((p) => {
                  const allocs = p.payment_allocations || [];
                  const remaining = remittanceRemaining(p, allocs);
                  const status = p.allocation_status === 'allocated' ? 'ALLOCATED' : 'UNALLOCATED';
                  const cust = p.customers;
                  const tagged =
                    (cust?.assigned_to && agents[cust.assigned_to]) ||
                    (p.sales_agent_id && agents[p.sales_agent_id]) ||
                    '';
                  const stockIds = allocs
                    .map((a) => a.vehicles?.stock_number)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <tr key={p.id} className="align-top hover:bg-muted/40">
                      <td className="px-3 py-3 text-xs leading-5">
                        <p className="font-semibold text-primary">ID: {paymentDisplayId(p.payment_code)}</p>
                        <p>Created: {isoDay(p.created_at)}</p>
                        <p>Remit: {isoDay(p.remit_date || p.payment_date)}</p>
                        <p>Received: {isoDay(p.received_date)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs leading-5">
                        <p>ID: {cust?.customer_code || '—'}</p>
                        <p className="font-medium text-foreground">{cust?.full_name || '—'}</p>
                        <p>{cust?.phone || ''}</p>
                        {tagged ? <p>Tagged With: {tagged}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-xs leading-5">
                        <p className="font-medium uppercase">{p.remitter_name || '—'}</p>
                        <p>{p.bank_name || '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-xs leading-5">
                        <p>Exchange Rate: {Number(p.exchange_rate || 0)}</p>
                        <p>Instructed Amount: {formatMoney(remittanceInstructed(p), p.currency)}</p>
                        <p>Remit Amount: {formatMoney(remittanceAmount(p), p.currency)}</p>
                        <p>Bank Charges: {formatMoney(Number(p.bank_charges) || 0, p.currency)}</p>
                        <p>Remaining Allocation: {formatMoney(remaining, p.currency)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs">{stockIds || '—'}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-bold tracking-wide text-primary">{status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded bg-red-600 px-1.5 text-[11px] font-bold text-white">
                          TT
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              Actions
                              <ChevronDown className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/payments/${p.id}/edit`}>Edit</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canCreate || canEdit ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/payments/${p.id}/allocate`}>Allocate</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete ? (
                              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteId(p.id)}>
                                Delete
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete remittance?"
        description="This removes the remittance and its stock allocations. Vehicle payment status will be recomputed."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
