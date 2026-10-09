'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle, Sale, Invoice, Payment, Expense, Purchase } from '@/lib/types';
import { BarChart3, CarFront, FileText, Landmark, Loader2, Package, Receipt, TrendingUp } from 'lucide-react';

interface ReportData {
  vehicles: Vehicle[];
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  purchases: Purchase[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [vRes, sRes, iRes, pRes, eRes, puRes] = await Promise.all([
      supabase.from('vehicles').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('purchases').select('*'),
    ]);
    setData({
      vehicles: (vRes.data || []) as Vehicle[],
      sales: (sRes.data || []) as Sale[],
      invoices: (iRes.data || []) as Invoice[],
      payments: (pRes.data || []) as Payment[],
      expenses: (eRes.data || []) as Expense[],
      purchases: (puRes.data || []) as Purchase[],
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !data) return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Filterable, exportable reports with date ranges and permission controls" />
      <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading report data...</div>
    </div>
  );

  const activeVehicles = data.vehicles.filter((v) => v.status === 'in_stock');
  const soldVehicles = data.vehicles.filter((v) => v.status === 'sold');
  const totalSalesRevenue = data.sales.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + s.sale_price, 0);
  const totalOutstanding = data.invoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + i.total, 0);
  const totalPayments = data.payments.filter((p) => p.status !== 'rejected').reduce((sum, p) => sum + p.amount_jpy, 0);
  const totalExpenses = data.expenses.filter((e) => e.status === 'paid' || e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  const totalPurchaseCost = data.purchases.filter((p) => p.status !== 'cancelled').reduce((sum, p) => sum + p.vehicle_price + p.auction_fees + p.transport_cost + p.inspection_cost + p.other_cost, 0);

  const salesByStatus = [
    { label: 'Reserved', count: data.sales.filter((s) => s.status === 'reserved').length, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Confirmed', count: data.sales.filter((s) => s.status === 'confirmed').length, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Paid', count: data.sales.filter((s) => s.status === 'paid').length, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Shipped', count: data.sales.filter((s) => s.status === 'shipped').length, tone: 'bg-cyan-50 text-cyan-600' },
    { label: 'Delivered', count: data.sales.filter((s) => s.status === 'delivered').length, tone: 'bg-slate-100 text-slate-600' },
    { label: 'Cancelled', count: data.sales.filter((s) => s.status === 'cancelled').length, tone: 'bg-red-50 text-red-600' },
  ];

  const invoicesByStatus = [
    { label: 'Unpaid', count: data.invoices.filter((i) => i.payment_status === 'unpaid').length, tone: 'bg-red-50 text-red-700' },
    { label: 'Partial', count: data.invoices.filter((i) => i.payment_status === 'partial').length, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Paid', count: data.invoices.filter((i) => i.payment_status === 'paid').length, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Cancelled', count: data.invoices.filter((i) => i.payment_status === 'cancelled').length, tone: 'bg-slate-100 text-slate-600' },
  ];

  const expenseByCategory = data.expenses.reduce((acc, e) => {
    if (e.status === 'rejected') return acc;
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const expenseCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Filterable, exportable reports with date ranges and permission controls" actions={<Select value={reportType} onValueChange={setReportType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="overview">Overview</SelectItem><SelectItem value="inventory">Inventory Ageing</SelectItem><SelectItem value="sales">Sales Pipeline</SelectItem><SelectItem value="invoices">Invoice Register</SelectItem><SelectItem value="expenses">Expense Breakdown</SelectItem></SelectContent></Select>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Active inventory', value: activeVehicles.length, icon: CarFront, tone: 'bg-blue-50 text-blue-600' },
        { label: 'Sales revenue', value: `${totalSalesRevenue.toLocaleString()}`, icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Outstanding', value: `${totalOutstanding.toLocaleString()}`, icon: FileText, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Total expenses', value: `${totalExpenses.toLocaleString()}`, icon: Receipt, tone: 'bg-red-50 text-red-600' },
        { label: 'Payments received', value: `${totalPayments.toLocaleString()}`, icon: Landmark, tone: 'bg-cyan-50 text-cyan-600' },
        { label: 'Purchase costs', value: `${totalPurchaseCost.toLocaleString()}`, icon: Package, tone: 'bg-slate-100 text-slate-600' },
        { label: 'Vehicles sold', value: soldVehicles.length, icon: CarFront, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Total invoices', value: data.invoices.length, icon: BarChart3, tone: 'bg-blue-50 text-blue-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div></CardContent></Card>)}</div>

      {reportType === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60"><CardContent className="p-4"><h3 className="mb-3 text-sm font-semibold">Sales by Status</h3><div className="space-y-2">{salesByStatus.map((s) => <div key={s.label} className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{s.label}</span><Badge variant="outline" className={s.tone}>{s.count}</Badge></div>)}</div></CardContent></Card>
          <Card className="border-border/60"><CardContent className="p-4"><h3 className="mb-3 text-sm font-semibold">Invoices by Payment Status</h3><div className="space-y-2">{invoicesByStatus.map((s) => <div key={s.label} className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{s.label}</span><Badge variant="outline" className={s.tone}>{s.count}</Badge></div>)}</div></CardContent></Card>
        </div>
      )}

      {reportType === 'inventory' && (
        <Card className="border-border/60"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Stock #</TableHead><TableHead>Vehicle</TableHead><TableHead>Chassis</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader><TableBody>{data.vehicles.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No vehicles in inventory</TableCell></TableRow> : data.vehicles.map((v) => <TableRow key={v.id}><TableCell className="font-medium">{v.stock_number}</TableCell><TableCell>{v.make} {v.model}</TableCell><TableCell className="text-muted-foreground">{v.chassis_number}</TableCell><TableCell><Badge variant="outline">{v.status.replace('_', ' ')}</Badge></TableCell><TableCell className="text-right">{v.listed_price ? `${v.listed_currency} ${v.listed_price.toLocaleString()}` : '—'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {reportType === 'sales' && (
        <Card className="border-border/60"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Sale #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Deposit</TableHead></TableRow></TableHeader><TableBody>{data.sales.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sales recorded</TableCell></TableRow> : data.sales.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{s.sale_code}</TableCell><TableCell className="text-muted-foreground">{new Date(s.sale_date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{s.status}</Badge></TableCell><TableCell className="text-right">{s.currency} {s.sale_price.toLocaleString()}</TableCell><TableCell className="text-right">{s.deposit_amount > 0 ? `${s.currency} ${s.deposit_amount.toLocaleString()}` : '—'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {reportType === 'invoices' && (
        <Card className="border-border/60"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Type</TableHead><TableHead>Issue Date</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{data.invoices.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No invoices recorded</TableCell></TableRow> : data.invoices.map((i) => <TableRow key={i.id}><TableCell className="font-medium">{i.invoice_code}</TableCell><TableCell className="text-muted-foreground">{i.invoice_type}</TableCell><TableCell className="text-muted-foreground">{new Date(i.issue_date).toLocaleDateString()}</TableCell><TableCell><Badge variant="outline">{i.payment_status}</Badge></TableCell><TableCell className="text-right">{i.currency} {i.total.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}

      {reportType === 'expenses' && (
        <Card className="border-border/60"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total Amount</TableHead></TableRow></TableHeader><TableBody>{expenseCategories.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No expenses recorded</TableCell></TableRow> : expenseCategories.map(([cat, amount]) => <TableRow key={cat}><TableCell className="font-medium">{cat}</TableCell><TableCell className="text-right font-semibold">{amount.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      )}
    </div>
  );
}
