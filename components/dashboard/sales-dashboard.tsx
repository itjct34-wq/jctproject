'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Users,
  Car,
  PackageCheck,
  FileText,
  Receipt,
  CreditCard,
  Plus,
  Landmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currencies';
import { sumByCurrency } from '@/lib/utils/format';
import { supabase } from '@/lib/supabase/client';
import type { Invoice } from '@/lib/types';

function isAuctionDepositInvoice(inv: Pick<Invoice, 'payment_terms' | 'invoice_code'>) {
  return (
    (inv.payment_terms || '').toUpperCase().startsWith('AUCTION DEPOSIT') ||
    /AD\d/i.test(inv.invoice_code || '')
  );
}

type Bucket = { currency: string; total: number };

interface SalesDashboardData {
  myCustomers: number;
  activeLeads: number;
  myReservedStock: number;
  availableToReserve: number;
  mySalesOpen: number;
  myQuotations: number;
  myInvoices: number;
  myAuctionInvoices: number;
  outstandingByCurrency: Bucket[];
  taggedPayments: number;
  paymentsByCurrency: Bucket[];
  recentReservations: Array<{ id: string; sale_code: string; status: string; sale_date: string }>;
}

function moneyLine(buckets: Bucket[]) {
  if (buckets.length === 0) return '—';
  return buckets.map((b) => formatCurrency(b.total, b.currency)).join(' · ');
}

function vehicleAvailable(v: { status: string; payment_status?: string | null }) {
  const pay = v.payment_status ?? (v.status === 'in_stock' ? 'available' : v.status === 'reserved' ? 'reserved' : 'paid');
  return pay === 'available' || (v.status === 'in_stock' && pay !== 'reserved' && pay !== 'paid');
}

export function SalesDashboard() {
  const { profile, roles } = useAuth();
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      setLoading(true);
      const uid = profile.id;

      const [customersRes, vehiclesRes, salesRes, quotationsRes, invoicesRes, paymentsRes] = await Promise.all([
        supabase.from('customers').select('id, status'),
        supabase.from('vehicles').select('id, status, payment_status, reserved_by'),
        supabase.from('sales').select('id, sale_code, status, sale_date, created_by').order('created_at', { ascending: false }).limit(8),
        supabase.from('quotations').select('id, created_by'),
        supabase.from('invoices').select('id, invoice_code, payment_terms, total, payment_status, currency, created_by'),
        supabase.from('payments').select('id, amount, remit_amount, currency, status'),
      ]);

      const failed = [customersRes, vehiclesRes, salesRes].find((r) => r.error);
      if (failed?.error) toast.error(`Dashboard: ${failed.error.message}`);

      const vehicles = vehiclesRes.data || [];
      const mySales = (salesRes.data || []).filter((s) => s.created_by === uid);
      const myInvoicesAll = (invoicesRes.data || []).filter((i) => i.created_by === uid);
      const commercialInvoices = myInvoicesAll.filter((i) => !isAuctionDepositInvoice(i));
      const auctionInvoices = myInvoicesAll.filter((i) => isAuctionDepositInvoice(i));
      const invoiceData = commercialInvoices as Array<{ total: number; payment_status: string; currency: string | null }>;
      const paymentData = (paymentsRes.data || []) as Array<{
        amount: number;
        remit_amount?: number | null;
        currency: string | null;
        status: string;
      }>;
      const receivedPayments = paymentData.filter((p) => p.status !== 'rejected');

      setData({
        myCustomers: customersRes.data?.length || 0,
        activeLeads: (customersRes.data || []).filter((c) => c.status === 'lead').length,
        myReservedStock: vehicles.filter((v) => v.reserved_by === uid || v.status === 'reserved').length,
        availableToReserve: vehicles.filter((v) => vehicleAvailable(v)).length,
        mySalesOpen: mySales.filter((s) => !['cancelled', 'delivered'].includes(s.status)).length,
        myQuotations: (quotationsRes.data || []).filter((q) => q.created_by === uid).length,
        myInvoices: commercialInvoices.length,
        myAuctionInvoices: auctionInvoices.length,
        outstandingByCurrency: sumByCurrency(
          invoiceData
            .filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial')
            .map((i) => ({ amount: Number(i.total) || 0, currency: i.currency }))
        ),
        taggedPayments: paymentData.length,
        paymentsByCurrency: sumByCurrency(
          receivedPayments.map((p) => ({
            amount: Number(p.remit_amount ?? p.amount) || 0,
            currency: p.currency,
          }))
        ),
        recentReservations: mySales.slice(0, 5) as SalesDashboardData['recentReservations'],
      });
      setLoading(false);
    }
    void load();
  }, [profile]);

  if (loading || !data) return <DashboardSkeleton />;

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  const kpis = [
    { label: 'My customers', value: String(data.myCustomers), sub: `${data.activeLeads} leads`, icon: Users, href: '/customers', tone: 'bg-brand/10 text-brand' },
    { label: 'My reserved stock', value: String(data.myReservedStock), sub: `${data.mySalesOpen} open reservations`, icon: PackageCheck, href: '/vehicles?status=reserved', tone: 'bg-warning/15 text-warning' },
    { label: 'Available to reserve', value: String(data.availableToReserve), sub: 'Browse available stock', icon: Car, href: '/vehicles?status=available', tone: 'bg-success/15 text-success' },
    { label: 'My quotations', value: String(data.myQuotations), sub: 'Quotes you created', icon: FileText, href: '/quotations', tone: 'bg-info/15 text-info' },
    { label: 'My invoices', value: String(data.myInvoices), sub: moneyLine(data.outstandingByCurrency) !== '—' ? `${moneyLine(data.outstandingByCurrency)} outstanding` : 'Commercial / proforma', icon: Receipt, href: '/invoices', tone: 'bg-info/15 text-info' },
    { label: 'Auction invoices', value: String(data.myAuctionInvoices), sub: 'Deposit invoices you issued', icon: Landmark, href: '/auction-invoices', tone: 'bg-muted text-foreground' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${currentDate} — your customers, reservations, and selling pipeline`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/quotations">New quotation</Link>
            </Button>
            <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" asChild>
              <Link href="/vehicles?status=available">Reserve stock</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Your roles:</span>
        {roles.map((role) => (
          <span key={role.id} className={cn('inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border', ROLE_COLORS[role.name])}>
            {role.display_name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="glass-panel-strong h-full border-border/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-glass">
              <div className="h-1 bg-gradient-to-r from-brand/90 to-info/50" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.tone}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{kpi.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/payments">
          <Card className="glass-panel-strong h-full border-border/40 transition-all duration-200 hover:border-brand/25 hover:shadow-glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5 text-brand/80" /> My tagged T/T (read-only)
              </div>
              <p className="mt-2 text-sm font-semibold">
                {data.taggedPayments} payments
                {data.paymentsByCurrency.length > 0 ? ` · ${moneyLine(data.paymentsByCurrency)}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">T/T linked to your customers — view only</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-panel-strong lg:col-span-2 border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent reservations</CardTitle>
            <Link href="/vehicles"><Button variant="ghost" size="sm" className="text-xs">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {data.recentReservations.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No reservations yet</div>
            ) : (
              <div className="space-y-3">
                {data.recentReservations.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sale.sale_code}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(sale.sale_date), 'MMM d, yyyy')}</p>
                    </div>
                    <span className="text-xs capitalize text-muted-foreground shrink-0">{sale.status}</span>
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
              { label: 'Reserve from stock', icon: Plus, href: '/vehicles' },
              { label: 'New quotation', icon: FileText, href: '/quotations' },
              { label: 'Browse stock', icon: Car, href: '/vehicles' },
              { label: 'Commercial invoices', icon: Receipt, href: '/invoices' },
              { label: 'Auction invoices', icon: Landmark, href: '/auction-invoices' },
              { label: 'View remittances / T/T', icon: CreditCard, href: '/payments' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-brand/[0.06]">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{action.label}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
