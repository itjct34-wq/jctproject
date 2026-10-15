'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';
import { formatMoney } from '@/lib/utils/format';
import { COMMISSION_STATUS_LABELS, effectiveCommissionStatus, soldProfitUsd } from '@/lib/vehicle-lifecycle';
import type { Customer, Office, Profile, Vehicle } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type CommissionRow = Pick<
  Vehicle,
  | 'id'
  | 'stock_number'
  | 'make'
  | 'model'
  | 'customer_id'
  | 'reserved_by'
  | 'sold_price'
  | 'fob_usd'
  | 'listed_price'
  | 'listed_currency'
  | 'commission_pkr'
  | 'commission_status'
  | 'payment_status'
  | 'shipping_status'
> & {
  customers?: Pick<Customer, 'id' | 'full_name'> | null;
};

function asCustomer(value: unknown): Pick<Customer, 'id' | 'full_name'> | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const rec = row as Partial<Customer>;
  if (!rec.id) return null;
  return { id: rec.id, full_name: rec.full_name || '' };
}

function personName(p: Pick<Profile, 'full_name' | 'display_name' | 'email'> | undefined) {
  if (!p) return 'Unassigned';
  return p.full_name?.trim() || p.display_name?.trim() || p.email;
}

export default function CommissionsPage() {
  const { profile } = useAuth();
  const { isAdmin, hasRole, isSellingFocused } = usePermissions();
  const canPay = isAdmin() || hasRole('manager') || hasRole('accounts');
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('vehicles')
      .select('id, stock_number, make, model, customer_id, reserved_by, sold_price, fob_usd, listed_price, listed_currency, commission_pkr, commission_status, payment_status, shipping_status, customers(id, full_name)')
      .in('commission_status', ['due', 'paid'])
      .gt('commission_pkr', 0)
      .order('updated_at', { ascending: false })
      .limit(ERP_LIST_LIMIT);
    if (isSellingFocused && profile?.id) {
      query = query.eq('reserved_by', profile.id);
    }
    const [{ data, error }, { data: people }, { data: officeRows }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name, display_name, email, office_id').limit(250),
      supabase.from('offices').select('id, name, code').eq('is_active', true).order('name'),
    ]);
    if (error) toast.error(`Unable to load commissions: ${error.message}`);
    else {
      setRows(
        (data || []).map((row) => {
          const item = row as unknown as CommissionRow;
          return { ...item, customers: asCustomer((row as { customers?: unknown }).customers) };
        })
      );
    }
    setProfiles((people || []) as Profile[]);
    setOffices((officeRows || []) as Office[]);
    setLoading(false);
  }, [isSellingFocused, profile?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const filtered = useMemo(() => {
    return rows.filter((v) => {
      const agentId = v.reserved_by || '';
      const agent = agentId ? profileById.get(agentId) : undefined;
      const status = effectiveCommissionStatus(v);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (agentFilter !== 'all' && agentId !== agentFilter) return false;
      if (officeFilter !== 'all' && (agent?.office_id || '') !== officeFilter) return false;
      return true;
    });
  }, [rows, agentFilter, officeFilter, statusFilter, profileById]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommissionRow[]>();
    for (const row of filtered) {
      const key = row.reserved_by || 'unassigned';
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => personName(profileById.get(a)).localeCompare(personName(profileById.get(b))));
  }, [filtered, profileById]);

  const payCommission = async (vehicleId: string) => {
    if (!canPay) {
      toast.error('Only admin, manager, or accounts can pay commission');
      return;
    }
    setPayingId(vehicleId);
    const { error } = await supabase
      .from('vehicles')
      .update({ commission_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', vehicleId);
    setPayingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Commission marked paid');
    await loadData();
  };

  const dueCount = rows.filter((r) => effectiveCommissionStatus(r) === 'due').length;
  const paidCount = rows.filter((r) => effectiveCommissionStatus(r) === 'paid').length;
  const duePkr = rows
    .filter((r) => effectiveCommissionStatus(r) === 'due')
    .reduce((sum, r) => sum + (Number(r.commission_pkr) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions"
        description={
          isSellingFocused
            ? 'Your vehicle commissions — due and paid'
            : 'Pay selling-agent commissions on paid or delivered stock'
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { label: 'Due', value: dueCount },
          { label: 'Paid', value: paidCount },
          { label: 'Due PKR', value: formatMoney(duePkr, 'PKR') },
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
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {personName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offices</SelectItem>
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Due and paid</SelectItem>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading commissions...
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-14 text-center text-sm text-muted-foreground">No commission rows match these filters.</div>
        ) : (
          grouped.map(([agentId, items]) => {
            const agent = profileById.get(agentId);
            const office = agent?.office_id ? offices.find((o) => o.id === agent.office_id) : null;
            return (
              <div key={agentId} className="border-b border-border/70 last:border-0">
                <div className="bg-muted/40 px-4 py-2 text-sm font-semibold">
                  {personName(agent)}
                  {office ? <span className="ml-2 font-normal text-muted-foreground">· {office.name}</span> : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr className="text-[11px] uppercase tracking-wide">
                        <th className="px-3 py-2 font-semibold">Stock</th>
                        <th className="px-3 py-2 font-semibold">Customer</th>
                        <th className="px-3 py-2 font-semibold">Agent</th>
                        <th className="px-3 py-2 font-semibold">Commission PKR</th>
                        <th className="px-3 py-2 font-semibold">Sold</th>
                        <th className="px-3 py-2 font-semibold">Profit</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        {canPay ? <th className="px-3 py-2 font-semibold">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {items.map((v) => {
                        const status = effectiveCommissionStatus(v);
                        const profit = soldProfitUsd(v);
                        const currency = v.listed_currency || 'USD';
                        return (
                          <tr key={v.id}>
                            <td className="px-3 py-2.5">
                              <p className="font-medium">{v.stock_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {v.make} {v.model}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">{v.customers?.full_name || '—'}</td>
                            <td className="px-3 py-2.5">{personName(agent)}</td>
                            <td className="px-3 py-2.5 font-medium">{formatMoney(Number(v.commission_pkr) || 0, 'PKR')}</td>
                            <td className="px-3 py-2.5">{v.sold_price != null ? formatMoney(Number(v.sold_price), currency) : '—'}</td>
                            <td className="px-3 py-2.5">{profit != null ? formatMoney(profit, currency) : '—'}</td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant="outline"
                                className={status === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800'}
                              >
                                {COMMISSION_STATUS_LABELS[status]}
                              </Badge>
                            </td>
                            {canPay ? (
                              <td className="px-3 py-2.5">
                                {status === 'due' ? (
                                  <Button size="sm" disabled={payingId === v.id} onClick={() => void payCommission(v.id)}>
                                    {payingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay commission'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Paid</span>
                                )}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
