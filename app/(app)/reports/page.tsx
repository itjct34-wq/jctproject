'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase/client';
import { formatMoney, formatDate } from '@/lib/utils/format';
import type { Vehicle, Sale, Invoice, Payment, Expense, Purchase } from '@/lib/types';
import { CarFront, FileText, Landmark, Loader2, Package, Receipt, TrendingUp } from 'lucide-react';

interface ReportData {
  vehicles: Vehicle[];
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  purchases: Purchase[];
}

function inRange(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!dateStr) return !from && !to;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [vRes, sRes, iRes, pRes, eRes, puRes] = await Promise.all([
      supabase.from('vehicles').select('id, stock_number, status, make, model, listed_price, listed_currency, created_at'),
      supabase.from('sales').select('id, sale_code, sale_date, status, sale_price, deposit_amount, currency'),
      supabase.from('invoices').select('id, invoice_code, invoice_type, issue_date, payment_status, total, currency'),
      supabase.from('payments').select('id, amount, currency, payment_date, status'),
      supabase.from('expenses').select('id, category, amount, currency, expense_date'),
      supabase.from('purchases').select('id, purchase_code, purchase_date, total_amount, currency, status'),
    ]);
    // Partial selects — cast via unknown to satisfy strict TS (full entity types are wider)
    setData({
      vehicles: (vRes.data || []) as unknown as Vehicle[],
      sales: (sRes.data || []) as unknown as Sale[],
      invoices: (iRes.data || []) as unknown as Invoice[],
      payments: (pRes.data || []) as unknown as Payment[],
      expenses: (eRes.data || []) as unknown as Expense[],
      purchases: (puRes.data || []) as unknown as Purchase[],
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (!data) return null;
    return {
      vehicles: data.vehicles,
      sales: data.sales.filter((s) => inRange(s.sale_date, dateFrom, dateTo)),
      invoices: data.invoices.filter((i) => inRange(i.issue_date, dateFrom, dateTo)),
      payments: data.payments.filter((p) => inRange(p.payment_date, dateFrom, dateTo)),
      expenses: data.expenses.filter((e) => inRange(e.expense_date, dateFrom, dateTo)),
      purchases: data.purchases.filter((p) => inRange(p.purchase_date, dateFrom, dateTo)),
    };
  }, [data, dateFrom, dateTo]);

  if (loading || !data || !filtered) return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Filterable reports with date ranges" />
      <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />Loading report data...
      </div>
    </div>
  );

  const activeVehicles = filtered.vehicles.filter((v) => v.status === 'in_stock');
  const soldVehicles = filtered.vehicles.filter((v) => v.status === 'sold');
  const totalSalesRevenue = filtered.sales.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0);
  const totalOutstanding = filtered.invoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const totalPayments = filtered.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalExpenses = filtered.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expenseCategories = Object.entries(
    filtered.expenses.reduce<Record<string, number>>((acc, e) => {
      const cat = e.category || 'Other';
      acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: 'In stock', value: activeVehicles.length, icon: CarFront, tone: 'text-emerald-600' },
    { label: 'Sold units', value: soldVehicles.length, icon: Package, tone: 'text-blue-600' },
    { label: 'Sales revenue', value: formatMoney(totalSalesRevenue), icon: TrendingUp, tone: 'text-primary' },
    { label: 'Outstanding', value: formatMoney(totalOutstanding), icon: FileText, tone: 'text-amber-600' },
    { label: 'Payments in', value: formatMoney(totalPayments), icon: Landmark, tone: 'text-emerald-600' },
    { label: 'Expenses', value: formatMoney(totalExpenses), icon: Receipt, tone: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Filterable reports with date ranges" />

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1 flex-1">
            <Label>Report type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="invoices">Invoices</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full md:w-40" />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full md:w-40" />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-primary hover:underline pb-2"
            >
              Clear dates
            </button>
          )}
        </CardContent>
      </Card>

      {reportType === 'overview' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className={`h-4 w-4 ${k.tone}`} />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
                <p className="text-lg font-bold truncate">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reportType === 'sales' && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Sale #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No sales in range</TableCell></TableRow>
                  ) : filtered.sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sale_code}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(s.sale_date)}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell className="text-right">{formatMoney(s.sale_price, s.currency)}</TableCell>
                      <TableCell className="text-right">{s.deposit_amount > 0 ? formatMoney(s.deposit_amount, s.currency) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'invoices' && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No invoices in range</TableCell></TableRow>
                  ) : filtered.invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.invoice_code}</TableCell>
                      <TableCell className="text-muted-foreground">{i.invoice_type}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(i.issue_date)}</TableCell>
                      <TableCell><Badge variant="outline">{i.payment_status}</Badge></TableCell>
                      <TableCell className="text-right">{formatMoney(i.total, i.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'expenses' && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseCategories.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-10">No expenses in range</TableCell></TableRow>
                ) : expenseCategories.map(([cat, amount]) => (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
