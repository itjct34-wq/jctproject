'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/utils/format';
import { supabase } from '@/lib/supabase/client';
import { Users, Car, Gavel, Receipt, CreditCard, Ship, CheckSquare, Bell, TrendingUp, DollarSign, Calendar, Clock, AlertTriangle, Activity, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedTasks: number;
  unreadNotifications: number;
  totalCustomers: number;
  activeLeads: number;
  totalVehicles: number;
  availableVehicles: number;
  reservedVehicles: number;
  pendingAuctions: number;
  totalSales: number;
  salesRevenue: number;
  totalInvoices: number;
  outstandingAmount: number;
  totalPayments: number;
  totalExpenses: number;
  activeShipments: number;
  recentTasks: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null; assigned_to: string }>;
  assigneeNames: Record<string, string>;
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

      const [usersRes, tasksRes, notifRes, recentTasksRes, customersRes, vehiclesRes, auctionsRes, salesRes, invoicesRes, paymentsRes, expensesRes, shipmentsRes] = await Promise.all([
        supabase.from('profiles').select('id, is_active'),
        supabase.from('tasks').select('id, status, due_date'),
        supabase.from('notifications').select('id').eq('user_id', profile.id).eq('is_read', false),
        supabase.from('tasks').select('id, title, status, priority, due_date, assigned_to').order('created_at', { ascending: false }).limit(5),
        supabase.from('customers').select('id, status'),
        supabase.from('vehicles').select('id, status'),
        supabase.from('auction_listings').select('id, result').eq('result', 'pending'),
        supabase.from('sales').select('id, sale_price, status, currency'),
        supabase.from('invoices').select('id, total, payment_status, currency'),
        supabase.from('payments').select('id, amount_jpy, status'),
        supabase.from('expenses').select('id, amount, status'),
        supabase.from('shipments').select('id, status'),
      ]);

      const allTasks = tasksRes.data || [];
      const now = format(new Date(), 'yyyy-MM-dd');
      const recentTasks = recentTasksRes.data || [];

      const assigneeIds = Array.from(new Set(recentTasks.map((t) => t.assigned_to)));
      const assigneeNames: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: assignees } = await supabase.from('profiles').select('id, full_name, email').in('id', assigneeIds);
        assignees?.forEach((a) => { assigneeNames[a.id] = a.full_name || a.email; });
      }

      const salesData = (salesRes.data || []) as Array<{ sale_price: number; status: string }>;
      const invoiceData = (invoicesRes.data || []) as Array<{ total: number; payment_status: string }>;
      const paymentData = (paymentsRes.data || []) as Array<{ amount_jpy: number; status: string }>;
      const expenseData = (expensesRes.data || []) as Array<{ amount: number; status: string }>;

      setData({
        totalUsers: usersRes.data?.length || 0,
        activeUsers: usersRes.data?.filter((u) => u.is_active).length || 0,
        totalTasks: allTasks.length,
        pendingTasks: allTasks.filter((t) => t.status === 'pending').length,
        overdueTasks: allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < now).length,
        completedTasks: allTasks.filter((t) => t.status === 'completed').length,
        unreadNotifications: notifRes.data?.length || 0,
        totalCustomers: customersRes.data?.length || 0,
        activeLeads: (customersRes.data || []).filter((c) => c.status === 'lead').length,
        totalVehicles: vehiclesRes.data?.length || 0,
        availableVehicles: (vehiclesRes.data || []).filter((v) => v.status === 'in_stock').length,
        reservedVehicles: (vehiclesRes.data || []).filter((v) => v.status === 'reserved').length,
        pendingAuctions: auctionsRes.data?.length || 0,
        totalSales: salesData.filter((s) => s.status !== 'cancelled').length,
        salesRevenue: salesData.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0),
        totalInvoices: invoiceData.length,
        outstandingAmount: invoiceData.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + (Number(i.total) || 0), 0),
        totalPayments: paymentData.filter((p) => p.status !== 'rejected').reduce((sum, p) => sum + (Number(p.amount_jpy) || 0), 0),
        totalExpenses: expenseData.filter((e) => e.status === 'paid' || e.status === 'approved').reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        activeShipments: (shipmentsRes.data || []).filter((s) => s.status === 'booked' || s.status === 'loaded' || s.status === 'in_transit').length,
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

  const businessKpis = [
    { label: 'Customers', value: data.totalCustomers, sub: `${data.activeLeads} leads`, icon: Users, href: '/customers', tone: 'bg-blue-50 text-blue-600' },
    { label: 'Vehicles in stock', value: data.availableVehicles, sub: `${data.reservedVehicles} reserved`, icon: Car, href: '/vehicles', tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pending auctions', value: data.pendingAuctions, sub: 'Awaiting results', icon: Gavel, href: '/auctions', tone: 'bg-amber-50 text-amber-600' },
    { label: 'Active shipments', value: data.activeShipments, sub: 'In progress', icon: Ship, href: '/shipments', tone: 'bg-cyan-50 text-cyan-600' },
    { label: 'Sales revenue', value: formatMoney(data.salesRevenue), sub: `${data.totalSales} sales`, icon: TrendingUp, href: '/sales', tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding', value: formatMoney(data.outstandingAmount), sub: `${data.totalInvoices} invoices`, icon: Receipt, href: '/invoices', tone: 'bg-red-50 text-red-600' },
    { label: 'Payments received', value: formatMoney(data.totalPayments), sub: 'Total JPY', icon: CreditCard, href: '/payments', tone: 'bg-cyan-50 text-cyan-600' },
    { label: 'Expenses', value: formatMoney(data.totalExpenses), sub: 'Approved + paid', icon: DollarSign, href: '/expenses', tone: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${firstName}`} description={`${currentDate} — Japan Circular Trading Co., Ltd. ERP System`} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Your roles:</span>
        {roles.map((role) => <span key={role.id} className={cn('inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border', ROLE_COLORS[role.name])}>{role.display_name}</span>)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {businessKpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="border-border/60 transition-shadow hover:shadow-md cursor-pointer h-full"><CardContent className="p-4">
              <div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.tone}`}><kpi.icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-xl font-bold">{kpi.value}</p></div></div>
              <p className="mt-2 text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent></Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent Tasks</CardTitle>
            <Link href="/tasks"><Button variant="ghost" size="sm" className="text-xs">View All</Button></Link>
          </CardHeader>
          <CardContent>
            {data.recentTasks.length === 0 ? <div className="text-center py-8 text-sm text-muted-foreground">No tasks created yet</div> : <div className="space-y-3">{data.recentTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{task.title}</p><p className="text-xs text-muted-foreground mt-0.5">Assigned to {data.assigneeNames[task.assigned_to] || 'Unknown'}{task.due_date && ` · Due ${format(new Date(task.due_date), 'MMM d')}`}</p></div><div className="flex items-center gap-2 shrink-0"><StatusBadge status={task.priority} /><StatusBadge status={task.status} /></div></div>)}</div>}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Manage Users & Teams', icon: Users, href: '/users', module: 'users' as const },
              { label: 'View Tasks', icon: CheckSquare, href: '/tasks', module: 'tasks' as const },
              { label: 'Reports & Analytics', icon: Activity, href: '/reports', module: 'reports' as const },
              { label: 'Audit Logs', icon: Clock, href: '/audit', module: 'audit' as const },
              { label: 'New Invoice', icon: Receipt, href: '/invoices', module: 'invoices' as const },
              { label: 'Vehicles', icon: Car, href: '/vehicles', module: 'vehicles' as const },
            ].filter((action) => canView(action.module)).map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <action.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{action.label}</span>
                </div>
              </Link>
            ))}
            <Link href="/notifications">
              <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Notifications</span>
                {data.unreadNotifications > 0 && <Badge className="ml-auto bg-primary text-primary-foreground text-[10px]">{data.unreadNotifications}</Badge>}
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
