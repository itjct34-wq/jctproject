'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usesSalesFocusedNav } from '@/lib/nav';
import { SalesDashboard } from '@/components/dashboard/sales-dashboard';
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
import { supabase } from '@/lib/supabase/client';
import { IconTile } from '@/components/ui/icon-tile';
import {
  Users, Car, Gavel, Receipt, CreditCard, Ship, CheckSquare, Bell,
  TrendingUp, DollarSign, Clock, Activity, Building2, MapPin, Upload,
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
  paymentsByCurrency: Bucket[];
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

function OperationsDashboardPage() {
  const { profile, roles } = useAuth();
  const { canView } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);

    const [
      customersRes,
      leadsRes,
      stockRes,
      reservedRes,
      auctionsRes,
      shipmentsBooked,
      shipmentsLoaded,
      shipmentsTransit,
      salesCountRes,
      officesRes,
      shiftsRes,
      notifRes,
      pendingTasksRes,
      recentTasksRes,
      moneyRes,
      overdueTasksRes,
    ] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'lead'),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'in_stock'),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'reserved'),
      supabase.from('auction_listings').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
      supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('status', 'booked'),
      supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('status', 'loaded'),
      supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('status', 'in_transit'),
      supabase.from('sales').select('id', { count: 'exact', head: true }).neq('status', 'cancelled'),
      supabase.from('offices').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, assigned_to')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.rpc('dashboard_money_by_currency'),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .lt('due_date', format(new Date(), 'yyyy-MM-dd')),
    ]);

    const critical = [customersRes, stockRes].find((r) => r.error);
    if (critical?.error) {
      setLoadError(critical.error.message);
      setLoading(false);
      toast.error(`Dashboard data: ${critical.error.message}`);
      return;
    }

    const recentTasks = recentTasksRes.data || [];
    const assigneeIds = Array.from(new Set(recentTasks.map((t) => t.assigned_to).filter(Boolean)));
    const assigneeNames: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabase.from('profiles').select('id, full_name, email').in('id', assigneeIds);
      assignees?.forEach((a) => {
        assigneeNames[a.id] = a.full_name || a.email;
      });
    }

    const moneyRows = (moneyRes.data || []) as Array<{ bucket: string; currency: string; total: number }>;
    const toBuckets = (bucket: string): Bucket[] =>
      moneyRows
        .filter((r) => r.bucket === bucket && Number(r.total) > 0)
        .map((r) => ({ currency: r.currency, total: Number(r.total) || 0 }));

    // Fallback if RPC not applied yet: empty money lines (counts still correct).
    if (moneyRes.error) {
      toast.error(`Money totals unavailable: ${moneyRes.error.message}`, {
        description: 'Counts still load. Apply migration 049_dashboard_aggregates if missing.',
      });
    }

    setData({
      totalCustomers: customersRes.count ?? 0,
      activeLeads: leadsRes.count ?? 0,
      availableVehicles: stockRes.count ?? 0,
      reservedVehicles: reservedRes.count ?? 0,
      pendingAuctions: auctionsRes.count ?? 0,
      activeShipments:
        (shipmentsBooked.count ?? 0) + (shipmentsLoaded.count ?? 0) + (shipmentsTransit.count ?? 0),
      totalSales: salesCountRes.count ?? 0,
      salesByCurrency: toBuckets('sales'),
      outstandingByCurrency: toBuckets('outstanding'),
      paymentsByCurrency: toBuckets('payments'),
      expensesByCurrency: toBuckets('expenses'),
      officeCount: officesRes.count ?? 0,
      shiftCount: shiftsRes.count ?? 0,
      unreadNotifications: notifRes.count ?? 0,
      pendingTasks: pendingTasksRes.count ?? 0,
      overdueTasks: overdueTasksRes.count ?? 0,
      recentTasks: recentTasks as DashboardData['recentTasks'],
      assigneeNames,
    });
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (loading && !data) return <DashboardSkeleton />;

  if (loadError && !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm font-medium text-foreground">Could not load dashboard</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  const kpis = [
    { label: 'Customers', value: String(data.totalCustomers), sub: `${data.activeLeads} leads`, icon: Users, href: '/customers', tone: 'brand' as const },
    { label: 'Vehicles in stock', value: String(data.availableVehicles), sub: `${data.reservedVehicles} reserved`, icon: Car, href: '/vehicles', tone: 'info' as const },
    { label: 'Pending auctions', value: String(data.pendingAuctions), sub: 'Awaiting results', icon: Gavel, href: '/auctions', tone: 'warning' as const },
    { label: 'Active shipments', value: String(data.activeShipments), sub: 'In progress', icon: Ship, href: '/shipments', tone: 'info' as const },
    { label: 'Offices', value: String(data.officeCount), sub: `${data.shiftCount} shifts`, icon: Building2, href: '/offices', tone: 'success' as const },
    { label: 'Open tasks', value: String(data.pendingTasks), sub: `${data.overdueTasks} overdue`, icon: CheckSquare, href: '/tasks', tone: 'brand' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${currentDate} — live stock, sales and offices`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">Export</Link>
            </Button>
            {canView('vehicles') ? (
              <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" asChild>
                <Link href="/vehicles">Reserve stock</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Your roles:</span>
        {roles.map((role) => (
          <span key={role.id} className={cn('inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border', ROLE_COLORS[role.name])}>{role.display_name}</span>
        ))}
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="w-[70%] shrink-0 snap-start sm:w-[45%] md:w-auto">
            <Card className="erp-stat-card h-full overflow-hidden border-border/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 active:scale-[0.98]">
              <div className="h-1 bg-gradient-to-r from-brand/90 to-info/50" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <IconTile icon={kpi.icon} size="md" tone={kpi.tone} />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
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
          { label: 'Sales by currency', value: moneyLine(data.salesByCurrency), sub: `${data.totalSales} sales`, href: '/vehicles', icon: TrendingUp },
          { label: 'Outstanding invoices', value: moneyLine(data.outstandingByCurrency), sub: 'Unpaid + partial, not mixed', href: '/invoices', icon: Receipt },
          { label: 'Expenses', value: moneyLine(data.expensesByCurrency), sub: 'Approved + paid', href: '/expenses', icon: DollarSign },
          ...(data.paymentsByCurrency.length === 0
            ? [{ label: 'Payments received', value: '—', sub: 'No remittances yet', href: '/payments', icon: CreditCard }]
            : data.paymentsByCurrency.map((bucket) => ({
                label: `Payments received · ${bucket.currency}`,
                value: formatCurrency(bucket.total, bucket.currency),
                sub: `${bucket.currency} ledger`,
                href: '/payments',
                icon: CreditCard,
              }))),
        ].map((row) => (
          <Link key={row.label} href={row.href}>
            <Card className="glass-panel-strong h-full border-border/40 transition-all duration-200 hover:border-brand/25 hover:shadow-glass">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <row.icon className="h-3.5 w-3.5 text-brand/80" /> {row.label}
                </div>
                <p className="mt-2 break-words text-sm font-semibold leading-snug">{row.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-panel-strong lg:col-span-2 border-border/40">
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

        <Card className="glass-panel-strong border-border/40">
          <CardHeader className="pb-3"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: 'Offices & shifts', icon: MapPin, href: '/offices', module: 'users' as const },
              { label: 'Bulk upload', icon: Upload, href: '/bulk-upload', module: 'vehicles' as const },
              { label: 'Vehicles', icon: Car, href: '/vehicles', module: 'vehicles' as const },
              { label: 'Stock pipeline', icon: Activity, href: '/vehicles/lifecycle', module: 'vehicles' as const },
              { label: 'New invoice', icon: Receipt, href: '/invoices', module: 'invoices' as const },
              { label: 'Users & teams', icon: Users, href: '/users', module: 'users' as const },
              { label: 'Reports', icon: Activity, href: '/reports', module: 'reports' as const },
              { label: 'Audit logs', icon: Clock, href: '/audit', module: 'audit' as const },
            ].filter((action) => canView(action.module)).map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-brand/[0.06]">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{action.label}</span>
                </div>
              </Link>
            ))}
            <Link href="/notifications">
              <div className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-brand/[0.06]">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Notifications</span>
                {data.unreadNotifications > 0 && (
                  <Badge className="ml-auto text-xs">{data.unreadNotifications}</Badge>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { roles } = useAuth();
  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);
  if (usesSalesFocusedNav(roleNames)) return <SalesDashboard />;
  return <OperationsDashboardPage />;
}
