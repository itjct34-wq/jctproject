'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SearchableSelect } from '@/components/payments/searchable-select';
import { TtDocumentChip } from '@/components/payments/tt-document-chip';
import { RemittanceCurrencyDashboard } from '@/components/payments/remittance-currency-dashboard';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Payment, PaymentAllocation } from '@/lib/types';
import {
  aggregateRemittanceByCurrency,
  isUnknownRemittance,
  paymentDisplayId,
  remittanceAmount,
  remittanceInstructed,
  remittanceRemaining,
} from '@/lib/remittance';
import { formatMoney } from '@/lib/utils/format';
import { toast } from 'sonner';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';

type AllocRow = PaymentAllocation & { vehicles?: { stock_number: string } | null };
type PaymentRow = Payment & {
  customers?: Pick<Customer, 'id' | 'customer_code' | 'full_name' | 'phone' | 'assigned_to'> | null;
  payment_allocations?: AllocRow[] | null;
};

type StaffOpt = { id: string; full_name: string | null; display_name: string | null };

/** Show Deallocate when fully allocated or any stock lines exist; otherwise Allocate. */
function remittanceHasAllocations(p: PaymentRow): boolean {
  const allocs = p.payment_allocations || [];
  if (allocs.length > 0) return true;
  return (p.allocation_status || 'unallocated') === 'allocated';
}

function ownsRemittanceForSales(p: PaymentRow, profileId: string): boolean {
  if (p.sales_agent_id === profileId) return true;
  if (p.created_by === profileId) return true;
  if (p.customers?.assigned_to === profileId) return true;
  return false;
}

function isoDay(value: string | null | undefined) {
  if (!value) return '—';
  const day = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return day[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd');
}

function RemittancesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { can, hasRole, isAdmin, isSellingFocused, isElevatedStaff } = usePermissions();
  const canCreate = can('payments', 'create');
  const canEdit = can('payments', 'edit');
  const canAllocateAction = canCreate || canEdit;
  const canDeallocateElevated = isAdmin() || hasRole('manager') || hasRole('accounts');
  const canDelete = can('payments', 'delete') || hasRole('accounts');
  const canManageUnknown = isElevatedStaff;
  const tab = searchParams.get('tab') === 'unknown' ? 'unknown' : 'all';
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deallocateTarget, setDeallocateTarget] = useState<PaymentRow | null>(null);
  const [tagTarget, setTagTarget] = useState<PaymentRow | null>(null);
  const [tagCustomerId, setTagCustomerId] = useState('');
  const [tagAgentId, setTagAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setTab = (next: 'all' | 'unknown') => {
    const qs = next === 'unknown' ? '?tab=unknown' : '';
    router.replace(`/payments${qs}`);
  };

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
    const [{ data: profiles }, { data: custAll }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, display_name').eq('is_active', true).limit(250),
      canManageUnknown
        ? supabase.from('customers').select('id, customer_code, full_name, phone, assigned_to').order('full_name').limit(500)
        : Promise.resolve({ data: [] as Customer[] }),
    ]);
    const map: Record<string, string> = {};
    const staffRows = (profiles || []) as StaffOpt[];
    for (const p of staffRows) {
      map[p.id] = p.full_name?.trim() || p.display_name?.trim() || '';
    }
    setAgents(map);
    setStaff(staffRows);
    setCustomers((custAll || []) as Customer[]);
    setLoading(false);
  }, [canManageUnknown]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === 'unknown' && !canManageUnknown) {
      router.replace('/payments');
    }
  }, [tab, canManageUnknown, router]);

  const unknownCount = useMemo(() => rows.filter((p) => isUnknownRemittance(p)).length, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      const unknown = isUnknownRemittance(p);
      if (tab === 'unknown' ? !unknown : unknown) return false;
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
  }, [rows, search, statusFilter, tab]);

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

  const openTag = (p: PaymentRow) => {
    setTagTarget(p);
    setTagCustomerId('');
    setTagAgentId('');
  };

  const onTagCustomer = (customer_id: string) => {
    setTagCustomerId(customer_id);
    const cust = customers.find((c) => c.id === customer_id);
    if (cust?.assigned_to) setTagAgentId(cust.assigned_to);
  };

  const confirmTag = async () => {
    if (!tagTarget) return;
    if (!tagCustomerId) {
      toast.error('Customer is required');
      return;
    }
    if (!tagAgentId) {
      toast.error('Sales agent is required');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('payments')
      .update({
        customer_id: tagCustomerId,
        sales_agent_id: tagAgentId,
        is_unknown: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tagTarget.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not tag: ${error.message}`);
      return;
    }
    toast.success('Tagged — remittance is ready to allocate');
    setTagTarget(null);
    router.replace('/payments');
    void loadData();
  };

  const tryAllocate = (p: PaymentRow) => {
    if (isUnknownRemittance(p) || !p.customer_id) {
      toast.error('Tag customer and sales agent before allocating to stock');
      return;
    }
    router.push(`/payments/${p.id}/allocate`);
  };

  const canDeallocateRemittance = (p: PaymentRow) => {
    if (!canAllocateAction || !profile?.id) return false;
    if (canDeallocateElevated) return true;
    return ownsRemittanceForSales(p, profile.id);
  };

  const confirmDeallocate = async () => {
    if (!deallocateTarget) return;
    if (!canDeallocateRemittance(deallocateTarget)) {
      toast.error('You do not have permission to deallocate this remittance');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('payment_allocations')
      .delete()
      .eq('payment_id', deallocateTarget.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not deallocate: ${error.message}`);
      return;
    }
    toast.success('Remittance deallocated — stock payment status updated');
    setDeallocateTarget(null);
    void loadData();
  };

  const currencyTotals = useMemo(() => aggregateRemittanceByCurrency(rows), [rows]);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.full_name} (${c.customer_code})`,
    keywords: `${c.phone || ''} ${c.customer_code}`,
  }));
  const agentOptions = staff.map((s) => ({
    value: s.id,
    label: s.full_name?.trim() || s.display_name?.trim() || s.id,
    keywords: s.display_name || '',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remittance Management"
        description={
          tab === 'unknown'
            ? 'Bank T/Ts waiting for customer and sales agent tagging'
            : isSellingFocused
              ? 'T/T remittances for your customers — create, allocate to stock, or edit'
              : 'Record bank remittances and allocate them to stock'
        }
        actions={
          canCreate || canManageUnknown ? (
            <div className="flex flex-wrap gap-2">
              {canManageUnknown ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/payments/new?unknown=1">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Unknown TT
                  </Link>
                </Button>
              ) : null}
              {canCreate ? (
                <Button size="sm" asChild>
                  <Link href="/payments/new">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add remittance
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {canManageUnknown ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v === 'unknown' ? 'unknown' : 'all')}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unknown">
              Unknown TT{unknownCount ? ` (${unknownCount})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {tab === 'unknown' ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Unknown TT</p>
              <p className="text-xl font-bold text-primary">{unknownCount}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <RemittanceCurrencyDashboard totals={currencyTotals} />
      )}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === 'unknown'
                    ? 'Search remitter, bank, code...'
                    : 'Search remitter, customer, code...'
                }
              />
            </div>
            {tab === 'all' ? (
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
            ) : null}
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
            {tab === 'unknown'
              ? 'No unknown T/Ts in the inbox.'
              : isSellingFocused
                ? 'No remittances for your customers yet.'
                : 'No remittances found.'}
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
                  const unknown = isUnknownRemittance(p);
                  const status = unknown
                    ? 'UNKNOWN'
                    : p.allocation_status === 'allocated'
                      ? 'ALLOCATED'
                      : 'UNALLOCATED';
                  const cust = p.customers;
                  const tagged =
                    (cust?.assigned_to && agents[cust.assigned_to]) ||
                    (p.sales_agent_id && agents[p.sales_agent_id]) ||
                    '';
                  const stockIds = allocs
                    .map((a) => a.vehicles?.stock_number)
                    .filter(Boolean)
                    .join(', ');
                  const hasAllocations = remittanceHasAllocations(p);
                  const showDeallocate = hasAllocations && canDeallocateRemittance(p);
                  const showAllocate = canAllocateAction && !hasAllocations;
                  return (
                    <tr key={p.id} className="align-top hover:bg-muted/40">
                      <td className="px-3 py-3 text-xs leading-5">
                        <p className="font-semibold text-primary">ID: {paymentDisplayId(p.payment_code)}</p>
                        <p>Created: {isoDay(p.created_at)}</p>
                        <p>Remit: {isoDay(p.remit_date || p.payment_date)}</p>
                        <p>Received: {isoDay(p.received_date)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs leading-5">
                        {unknown ? (
                          <>
                            <p className="font-medium text-amber-800">Untagged</p>
                            <p className="text-muted-foreground">Customer / agent unknown</p>
                          </>
                        ) : (
                          <>
                            <p>ID: {cust?.customer_code || '—'}</p>
                            <p className="font-medium text-foreground">{cust?.full_name || '—'}</p>
                            <p>{cust?.phone || ''}</p>
                            {tagged ? <p>Tagged With: {tagged}</p> : null}
                          </>
                        )}
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
                        <span
                          className={
                            unknown
                              ? 'text-xs font-bold tracking-wide text-amber-800'
                              : 'text-xs font-bold tracking-wide text-primary'
                          }
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <TtDocumentChip paymentId={p.id} canEdit={canEdit || canManageUnknown} />
                      </td>
                      <td className="relative overflow-visible px-3 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              Actions
                              <ChevronDown className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[100]">
                            {unknown && canManageUnknown ? (
                              <DropdownMenuItem onSelect={() => openTag(p)}>Tag customer / agent</DropdownMenuItem>
                            ) : null}
                            {canEdit || (unknown && canManageUnknown) ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/payments/${p.id}/edit`}>Edit</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {showAllocate ? (
                              <DropdownMenuItem
                                onSelect={() => tryAllocate(p)}
                                disabled={unknown}
                              >
                                Allocate
                              </DropdownMenuItem>
                            ) : null}
                            {showDeallocate ? (
                              <DropdownMenuItem onSelect={() => setDeallocateTarget(p)}>
                                Deallocate
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
      <ConfirmDialog
        open={Boolean(deallocateTarget)}
        onOpenChange={(open) => !open && setDeallocateTarget(null)}
        title="Deallocate remittance?"
        description="This clears all stock allocations for this remittance, sets it back to unallocated, and recomputes each vehicle’s payment status (partial / reserved / unpaid as appropriate)."
        confirmLabel="Deallocate"
        destructive
        loading={submitting}
        onConfirm={confirmDeallocate}
      />
      <Dialog open={Boolean(tagTarget)} onOpenChange={(open) => !open && setTagTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag Unknown TT</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign customer and sales agent so this remittance appears in the normal list and can be allocated to
              stock.
            </p>
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <SearchableSelect
                value={tagCustomerId}
                onChange={onTagCustomer}
                options={customerOptions}
                placeholder="Search customer"
                searchPlaceholder="Search customer"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales agent *</Label>
              <SearchableSelect
                value={tagAgentId}
                onChange={setTagAgentId}
                options={agentOptions}
                placeholder="Search agent"
                searchPlaceholder="Search agent"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void confirmTag()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RemittancesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading remittances...
        </div>
      }
    >
      <RemittancesPageInner />
    </Suspense>
  );
}
