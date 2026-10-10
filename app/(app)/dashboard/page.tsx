'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { sumByCurrency } from '@/lib/utils/format';
import { supabase } from '@/lib/supabase/client';
import {
  Users, Car, Gavel, Receipt, CreditCard, Ship, CheckSquare, Bell,
  TrendingUp, DollarSign, Clock, Activity, Building2, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Bucket = { currency: string; total: number };

interface DashboardData {
  totalCustomers: number;
  activeLeads: number;
  availableVehicles: number;
  reservedVehicles: number;
  pendingAuctions: number;
  activeShipments: number;
  totalSales: number;
  salesByCurrency: Bucket[];
  outstandingByCurrency: Bucket[];
  paymentsJpy: number;
  expensesByCurrency: Bucket[];
  officeCount: number;
  shiftCount: number;
  unreadNotifications: number;
  pendingTasks: number;
  overdueTasks: number;
  recentTasks: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null; assigned_to: string }>;
  assigneeNames: Record<string, string>;
}

function moneyLine(buckets: Bucket[]) {
  if (buckets.length === 0) return '—';
  return buckets.map((b) => formatCurrency(b.total, b.currency)).join(' · ');
}

export default function DashboardPage() {
  const { profile, roles } = useAuth();
  const { canView } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!profile) return;
      setLoading(true);

      const [
        tasksRes, notifRes, recentTasksRes, customersRes, vehiclesRes,
        auctionsRes, salesRes, invoicesRes, paymentsRes, expensesRes,
        shipmentsRes, officesRes, shiftsRes,
      ] = await Promise.all([
        supabase.from('tasks').select('id, status, due_date'),
        supabase.from('notifications').select('id').eq('user_id', profile.id).eq('is_read', false),
        supabase.from('tasks').select('id, title, status, priority, due_date, assigned_to').order('created_at', { ascending: false }).limit(5),
        supabase.from('customers').select('id, status'),
        supabase.from('vehicles').select('id, status'),
        supabase.from('auction_listings').select('id, result').eq('result', 'pending'),
        supabase.from('sales').select('id, sale_price, status, currency'),
        supabase.from('invoices').select('id, total, payment_status, currency'),
        supabase.from('payments').select('id, amount_jpy, status'),
        supabase.from('expenses').select('id, amount, status, currency'),
        supabase.from('shipments').select('id, status'),
        supabase.from('offices').select('id, is_active'),
        supabase.from('shifts').select('id, is_active'),
      ]);

      const failed = [customersRes, vehiclesRes, salesRes, invoicesRes].find((r) => r.error);
      if (failed?.error) toast.error(`Dashboard data: ${failed.error.message}`);

      const allTasks = tasksRes.data || [];
      const now = format(new Date(), 'yyyy-MM-dd');
      const recentTasks = recentTasksRes.data || [];
      const assigneeIds = Array.from(new Set(recentTasks.map((t) => t.assigned_to).filter(Boolean)));
      const assigneeNames: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: assignees } = await supabase.from('profiles').select('id, full_name, email').in('id', assigneeIds);
        assignees?.forEach((a) => { assigneeNames[a.id] = a.full_name || a.email; });
      }

      const salesData = (salesRes.data || []) as Array<{ sale_price: number; status: string; currency: string | null }>;
      const invoiceData = (invoicesRes.data || []) as Array<{ total: number; payment_status: string; currency: string | null }>;
      const paymentData = (paymentsRes.data || []) as Array<{ amount_jpy: number; status: string }>;
      const expenseData = (expensesRes.data || []) as Array<{ amount: number; status: string; currency?: string | null }>;

      setData({
        totalCustomers: customersRes.data?.length || 0,
        activeLeads: (customersRes.data || []).filter((c) => c.status === 'lead').length,
        availableVehicles: (vehiclesRes.data || []).filter((v) => v.status === 'in_stock').length,
        reservedVehicles: (vehiclesRes.data || []).filter((v) => v.status === 'reserved').length,
        pendingAuctions: auctionsRes.data?.length || 0,
        activeShipments: (shipmentsRes.data || []).filter((s) => ['booked', 'loaded', 'in_transit'].includes(s.status)).length,
        totalSales: salesData.filter((s) => s.status !== 'cancelled').length,
        salesByCurrency: sumByCurrency(
          salesData.filter((s) => s.status !== 'cancelled').map((s) => ({ amount: Number(s.sale_price) || 0, currency: s.currency }))
        ),
        outstandingByCurrency: sumByCurrency(
          invoiceData
            .filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial')
            .map((i) => ({ amount: Number(i.total) || 0, currency: i.currency }))
        ),
        paymentsJpy: paymentData.filter((p) => p.status !== 'rejected').reduce((sum, p) => sum + (Number(p.amount_jpy) || 0), 0),
        expensesByCurrency: sumByCurrency(
          expenseData
            .filter((e) => e.status === 'paid' || e.status === 'approved')
            .map((e) => ({ amount: Number(e.amount) || 0, currency: e.currency || 'JPY' }))
        ),
        officeCount: (officesRes.data || []).filter((o) => o.is_active !== false).length,
        shiftCount: (shiftsRes.data || []).filter((s) => s.is_active !== false).length,
        unreadNotifications: notifRes.data?.length || 0,
        pendingTasks: allTasks.filter((t) => t.status === 'pending').length,
        overdueTasks: allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < now).length,
        recentTasks: recentTasks as DashboardData['recentTasks'],
        assigneeNames,
      });
      setLoading(false);
    }
    loadDashboard();
  }, [profile]);

  if (loading || !data) return <DashboardSkeleton />;

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  const kpis = [
    { label: 'Customers', value: String(data.totalCustomers), sub: `${data.activeLeads} leads`, icon: Users, href: '/customers', tone: 'bg-blue-50 text-blue-600' },
    { label: 'Vehicles in stock', value: String(data.availableVehicles), sub: `${data.reservedVehicles} reserved`, icon: Car, href: '/vehicles', tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending auctions', value: String(data.pendingAuctions), sub: 'Awaiting results', icon: Gavel, href: '/auctions', tone: 'bg-amber-50 text-amber-600' },
    { label: 'Active shipments', value: String(data.activeShipments), sub: 'In progress', icon: Ship, href: '/shipments', tone: 'bg-cyan-50 text-cyan-600' },
    { label: 'Offices', value: String(data.officeCount), sub: `${data.shiftCount} shifts`, icon: Building2, href: '/offices', tone: 'bg-violet-50 text-violet-600' },
    { label: 'Open tasks', value: String(data.pendingTasks), sub: `${data.overdueTasks} overdue`, icon: CheckSquare, href: '/tasks', tone: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${firstName}`} description={`${currentDate} — live stock, sales and offices`} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Your roles:</span>
        {roles.map((role) => (
          <span key={role.id} className={cn('inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border', ROLE_COLORS[role.name])}>{role.display_name}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="border-border/60 transition-shadow hover:shadow-md h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kpi.tone}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Sales by currency', value: moneyLine(data.salesByCurrency), sub: `${data.totalSales} sales`, href: '/sales', icon: TrendingUp },
          { label: 'Outstanding invoices', value: moneyLine(data.outstandingByCurrency), sub: 'Unpaid + partial, not mixed', href: '/invoices', icon: Receipt },
          { label: 'Payments received', value: formatCurrency(data.paymentsJpy, 'JPY'), sub: 'JPY ledger', href: '/payments', icon: CreditCard },
          { label: 'Expenses', value: moneyLine(data.expensesByCurrency), sub: 'Approved + paid', href: '/expenses', icon: DollarSign },
        ].map((row) => (
          <Link key={row.label} href={row.href}>
            <Card className="border-border/60 h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <row.icon className="h-3.5 w-3.5" /> {row.label}
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug break-words">{row.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent tasks</CardTitle>
            <Link href="/tasks"><Button variant="ghost" size="sm" className="text-xs">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {data.recentTasks.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No tasks yet</div>
            ) : (
              <div className="space-y-3">
                {data.recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {data.assigneeNames[task.assigned_to] || 'Unassigned'}
                        {task.due_date ? ` · Due ${format(new Date(task.due_date), 'MMM d')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: 'Offices & shifts', icon: MapPin, href: '/offices', module: 'users' as const },
              { label: 'Vehicles', icon: Car, href: '/vehicles', module: 'vehicles' as const },
              { label: 'New invoice', icon: Receipt, href: '/invoices', module: 'invoices' as const },
              { label: 'Users & teams', icon: Users, href: '/users', module: 'users' as const },
              { label: 'Reports', icon: Activity, href: '/reports', module: 'reports' as const },
              { label: 'Audit logs', icon: Clock, href: '/audit', module: 'audit' as const },
            ].filter((action) => canView(action.module)).map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors">
                  <action.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{action.label}</span>
                </div>
              </Link>
            ))}
            <Link href="/notifications">
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Notifications</span>
                {data.unreadNotifications > 0 && (
                  <Badge className="ml-auto text-[10px]">{data.unreadNotifications}</Badge>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
