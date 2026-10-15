'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { SearchableSelect } from '@/components/payments/searchable-select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';
import {
  commissionDuePkr,
  commissionPaidPkr,
  ledgerTotals,
  paymentTaggedToAgent,
  vehicleBalanceDue,
  type LedgerAlloc,
  type LedgerPayment,
  type LedgerVehicle,
} from '@/lib/agent-ledger';
import { remittanceAmount, remittanceRemaining, vehicleSoldPrice } from '@/lib/remittance';
import { formatMoney } from '@/lib/utils/format';
import { COMMISSION_STATUS_LABELS, effectiveCommissionStatus, publicFobUsd, soldProfitUsd } from '@/lib/vehicle-lifecycle';
import type { Customer, Payment, PaymentAllocation, Profile, Vehicle } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_ROLES = new Set(['sales_agent', 'freelancer', 'manager']);

function personName(p: Pick<Profile, 'full_name' | 'display_name' | 'email'> | undefined) {
  if (!p) return 'Select agent';
  return p.full_name?.trim() || p.display_name?.trim() || p.email;
}

type PayRow = Payment & { customers?: Pick<Customer, 'id' | 'full_name' | 'assigned_to'> | null };

function asCustomer(value: unknown): Pick<Customer, 'id' | 'full_name' | 'assigned_to'> | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const rec = row as Partial<Customer>;
  if (!rec.id) return null;
  return { id: rec.id, full_name: rec.full_name || '', assigned_to: rec.assigned_to ?? null };
}

export default function AgentLedgerPage() {
  const { profile } = useAuth();
  const { isSellingFocused } = usePermissions();
  const [agents, setAgents] = useState<Profile[]>([]);
  const [agentId, setAgentId] = useState('');
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [allocs, setAllocs] = useState<PaymentAllocation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    const loadAgents = async () => {
      setLoadingAgents(true);
      const [{ data: people }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, display_name, email, office_id, is_active').eq('is_active', true).limit(250),
        supabase.from('user_roles').select('user_id, is_active, roles(name)').eq('is_active', true),
      ]);
      const allowed = new Set<string>();
      (roleRows || []).forEach((row: { user_id: string; roles?: { name: string } | { name: string }[] | null }) => {
        const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
        if (role?.name && AGENT_ROLES.has(role.name)) allowed.add(row.user_id);
      });
      const list = ((people || []) as Profile[]).filter((p) => allowed.size === 0 || allowed.has(p.id));
      setAgents(list);
      if (isSellingFocused && profile?.id) setAgentId(profile.id);
      else if (!agentId && list[0]) setAgentId(list[0].id);
      setLoadingAgents(false);
    };
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed agent once
  }, [isSellingFocused, profile?.id]);

  const loadLedger = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    const [{ data: pays, error: payErr }, { data: stock, error: vehErr }, { data: custs }] = await Promise.all([
      supabase
        .from('payments')
        .select('*, customers(id, full_name, assigned_to)')
        .order('created_at', { ascending: false })
        .limit(ERP_LIST_LIMIT),
      supabase
        .from('vehicles')
        .select('id, stock_number, make, model, sold_price, fob_usd, listed_price, listed_currency, commission_pkr, commission_status, reserved_by, customer_id, status, payment_status')
        .eq('reserved_by', agentId)
        .neq('status', 'archived')
        .limit(ERP_LIST_LIMIT),
      supabase.from('customers').select('id, full_name, assigned_to').eq('assigned_to', agentId).limit(ERP_LIST_LIMIT),
    ]);
    if (payErr) toast.error(`Unable to load remittances: ${payErr.message}`);
    if (vehErr) toast.error(`Unable to load vehicles: ${vehErr.message}`);
    const tagged = ((pays || []) as Payment[])
      .map((p) => ({ ...p, customers: asCustomer((p as PayRow).customers) }))
      .filter((p) => paymentTaggedToAgent(p, p.customers?.assigned_to, agentId));
    setPayments(tagged);
    setVehicles((stock || []) as Vehicle[]);
    setCustomers((custs || []) as Customer[]);
    const payIds = tagged.map((p) => p.id);
    const vehIds = ((stock || []) as Array<{ id: string }>).map((v) => v.id);
    const [byPay, byVeh] = await Promise.all([
      payIds.length
        ? supabase.from('payment_allocations').select('id, payment_id, vehicle_id, allocate_amount, sold_price, created_by, created_at').in('payment_id', payIds)
        : Promise.resolve({ data: [] as PaymentAllocation[] }),
      vehIds.length
        ? supabase.from('payment_allocations').select('id, payment_id, vehicle_id, allocate_amount, sold_price, created_by, created_at').in('vehicle_id', vehIds)
        : Promise.resolve({ data: [] as PaymentAllocation[] }),
    ]);
    const merged = new Map<string, PaymentAllocation>();
    for (const row of [...(byPay.data || []), ...(byVeh.data || [])] as PaymentAllocation[]) {
      merged.set(row.id, row);
    }
    setAllocs([...merged.values()]);
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const totals = useMemo(
    () => ledgerTotals(payments as LedgerPayment[], allocs as LedgerAlloc[], vehicles as LedgerVehicle[]),
    [payments, allocs, vehicles]
  );

  const customerName = (id: string | null | undefined) => customers.find((c) => c.id === id)?.full_name
    || payments.find((p) => p.customer_id === id)?.customers?.full_name
    || '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent ledger"
        description="Remittances, sold stock, balances, profit, and vehicle commissions for one agent"
      />
      <Card className="border-border/60">
        <CardContent className="p-4">
          {loadingAgents ? (
            <p className="text-sm text-muted-foreground">Loading agents...</p>
          ) : isSellingFocused ? (
            <p className="text-sm">
              Showing your ledger: <span className="font-semibold">{personName(profile || undefined)}</span>
            </p>
          ) : (
            <div className="max-w-md">
              <SearchableSelect
                value={agentId}
                onChange={setAgentId}
                options={agents.map((a) => ({ value: a.id, label: personName(a), keywords: a.email }))}
                placeholder="Pick sales agent, freelancer, or manager"
                searchPlaceholder="Search agent..."
              />
            </div>
          )}
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading ledger...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Remittance received', value: formatMoney(totals.remittanceReceived) },
              { label: 'Allocated', value: formatMoney(totals.remittanceAllocated) },
              { label: 'Unallocated', value: formatMoney(totals.remittanceUnallocated) },
              { label: 'Vehicles', value: String(totals.vehicleCount) },
              { label: 'Total profit', value: formatMoney(totals.totalProfit, 'USD') },
              { label: 'Commission due', value: formatMoney(totals.commissionsDue, 'PKR') },
              { label: 'Commission paid', value: formatMoney(totals.commissionsPaid, 'PKR') },
            ].map((s) => (
              <Card key={s.label} className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold text-primary">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden border-border/60">
            <div className="border-b border-border/70 px-4 py-3 font-semibold">Remittances tagged to this agent</div>
            {payments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No remittances tagged via sales agent or assigned customer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Received</th>
                      <th className="px-3 py-2">Unallocated</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {payments.map((p) => {
                      const remaining = remittanceRemaining(p, allocs.filter((a) => a.payment_id === p.id));
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium">{p.payment_code}</td>
                          <td className="px-3 py-2">{p.customers?.full_name || '—'}</td>
                          <td className="px-3 py-2">{formatMoney(remittanceAmount(p), p.currency)}</td>
                          <td className="px-3 py-2">{formatMoney(remaining, p.currency)}</td>
                          <td className="px-3 py-2">{p.allocation_status || 'unallocated'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card className="overflow-hidden border-border/60">
            <div className="border-b border-border/70 px-4 py-3 font-semibold">Sold / reserved vehicles</div>
            {vehicles.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No reserved or sold vehicles for this agent.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2">Stock</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">FOB</th>
                      <th className="px-3 py-2">Profit</th>
                      <th className="px-3 py-2">Balance due</th>
                      <th className="px-3 py-2">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {vehicles.map((v) => {
                      const currency = v.listed_currency || 'USD';
                      const profit = soldProfitUsd(v);
                      const fob = publicFobUsd(v);
                      const status = effectiveCommissionStatus(v);
                      const due = commissionDuePkr(v);
                      const paid = commissionPaidPkr(v);
                      return (
                        <tr key={v.id}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{v.stock_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.make} {v.model}
                            </p>
                          </td>
                          <td className="px-3 py-2.5">{customerName(v.customer_id)}</td>
                          <td className="px-3 py-2.5">{formatMoney(vehicleSoldPrice(v), currency)}</td>
                          <td className="px-3 py-2.5">{fob != null ? formatMoney(fob, currency) : '—'}</td>
                          <td className="px-3 py-2.5">{profit != null ? formatMoney(profit, currency) : '—'}</td>
                          <td className="px-3 py-2.5">{formatMoney(vehicleBalanceDue(v, allocs), currency)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : status === 'due' ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800' : ''}
                              >
                                {COMMISSION_STATUS_LABELS[status]}
                              </Badge>
                              <span className="text-xs">
                                due {formatMoney(due, 'PKR')} · paid {formatMoney(paid, 'PKR')}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
