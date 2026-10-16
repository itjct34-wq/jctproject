'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { CarFront, Loader2, Pencil, Ship, Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CommercialInvoiceTemplate } from '@/components/invoices/commercial-invoice-template';
import { ShippingStepper } from '@/components/vehicles/shipping-stepper';
import { VehicleShippingDocs } from '@/components/vehicles/vehicle-shipping-docs';
import { supabase } from '@/lib/supabase/client';
import { resolveSourceCountry } from '@/lib/source-countries';
import { formatMoney } from '@/lib/utils/format';
import { printDocumentPdf } from '@/lib/utils/print-document-pdf';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';
import { cn } from '@/lib/utils';
import type { VehicleRemittanceRef } from '@/components/vehicles/vehicle-remittance-popover';
import type { CompanySettings, Customer, Invoice, InvoiceItem, Vehicle } from '@/lib/types';
import type { CompanyLetterheadSettings } from '@/lib/jct-official';
import {
  commissionAmountPkr,
  effectiveCommissionStatus,
  effectivePaymentStatus,
  effectiveShippingStatus,
  FREIGHT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  publicFobUsd,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUS_STYLES,
  soldProfitUsd,
} from '@/lib/vehicle-lifecycle';
import { toast } from 'sonner';

export const VIEW_INFO_TABS = [
  'details',
  'history',
  'invoices',
  'remittances',
  'documents',
  'shipping',
] as const;

export type ViewInfoTab = (typeof VIEW_INFO_TABS)[number];

export const VIEW_INFO_DEFAULT_TAB: ViewInfoTab = 'details';

const TAB_LABELS: Record<ViewInfoTab, string> = {
  details: 'Details',
  history: 'History',
  invoices: 'Invoices',
  remittances: 'Remittances',
  documents: 'Documents',
  shipping: 'Shipping & courier',
};

type HistoryRow = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  performedOn: string;
  at: string;
};

type InvoiceListRow = Invoice;

type RemittanceRow = {
  id: string;
  paymentId: string;
  paymentCode: string;
  allocateAmount: number;
  soldPrice: number | null;
  currency: string;
  status: string;
  remitterName: string | null;
  paymentDate: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  agentName: string;
  customerName: string;
  customers: Pick<Customer, 'id' | 'full_name' | 'customer_code' | 'company_name' | 'country' | 'city' | 'address_line1' | 'phone' | 'email'>[];
  statusLabels: Record<Vehicle['status'], string>;
  canReserveStock: boolean;
  canEditVehicle: boolean;
  canEditShipping: boolean;
  canDeleteVehicle: boolean;
  canMarkCommissionPaid: boolean;
  canDeallocateRemittance?: boolean;
  submitting?: boolean;
  onReserve: () => void;
  onEdit: () => void;
  onBooking: () => void;
  onDelete: () => void;
  onMarkCommissionPaid: () => void;
  onDeallocateRemittance?: (row: VehicleRemittanceRef) => void;
  onDocsChanged?: () => void;
  /** Bump after external remittance changes so the Remittances tab reloads. */
  remittanceReloadToken?: number;
};

function formatHistoryDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "do MMMM yyyy, h:mm a");
}

function isoDay(value: string | null | undefined) {
  if (!value) return '';
  const day = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return day[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isAuctionDepositInvoice(inv: Pick<Invoice, 'payment_terms' | 'invoice_code'>) {
  return (
    (inv.payment_terms || '').toUpperCase().startsWith('AUCTION DEPOSIT') ||
    /AD\d/i.test(inv.invoice_code || '')
  );
}

function SpecCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground break-words">{value || '—'}</p>
    </div>
  );
}

function PillTabs({
  value,
  onChange,
}: {
  value: ViewInfoTab;
  onChange: (tab: ViewInfoTab) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pr-8">
      {VIEW_INFO_TABS.map((tab) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-border bg-background text-foreground hover:bg-muted/60'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}

export function VehicleViewInfoDialog({
  open,
  onOpenChange,
  vehicle,
  agentName,
  customerName,
  customers,
  statusLabels,
  canReserveStock,
  canEditVehicle,
  canEditShipping,
  canDeleteVehicle,
  canMarkCommissionPaid,
  canDeallocateRemittance = false,
  submitting,
  onReserve,
  onEdit,
  onBooking,
  onDelete,
  onMarkCommissionPaid,
  onDeallocateRemittance,
  onDocsChanged,
  remittanceReloadToken = 0,
}: Props) {
  const [tab, setTab] = useState<ViewInfoTab>(VIEW_INFO_DEFAULT_TAB);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [remittancesLoading, setRemittancesLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewItems, setPreviewItems] = useState<InvoiceItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [companyLetterhead, setCompanyLetterhead] = useState<CompanyLetterheadSettings | null>(null);

  useEffect(() => {
    if (open) setTab(VIEW_INFO_DEFAULT_TAB);
  }, [open, vehicle?.id]);

  useEffect(() => {
    if (!open && !previewOpen) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name, legal_name, logo_url, hanko_url')
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as Pick<CompanySettings, 'company_name' | 'legal_name' | 'logo_url' | 'hanko_url'>;
      setCompanyLetterhead({
        company_name: row.company_name,
        legal_name: row.legal_name,
        logo_url: row.logo_url,
        hanko_url: row.hanko_url,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, previewOpen]);

  const loadHistory = useCallback(async (vehicleId: string) => {
    setHistoryLoading(true);
    const [auditRes, statusRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id, user_id, action, module, record_type, created_at')
        .eq('record_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('vehicle_status_history')
        .select('id, from_status, to_status, note, changed_by, created_at')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (auditRes.error) toast.error('Could not load audit history: ' + auditRes.error.message);
    if (statusRes.error) toast.error('Could not load status history: ' + statusRes.error.message);

    const userIds = new Set<string>();
    for (const row of auditRes.data || []) if (row.user_id) userIds.add(row.user_id);
    for (const row of statusRes.data || []) if (row.changed_by) userIds.add(row.changed_by);

    const nameMap: Record<string, string> = {};
    if (userIds.size) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .in('id', [...userIds]);
      for (const p of profiles || []) {
        nameMap[p.id] = p.full_name?.trim() || p.display_name?.trim() || p.email || p.id.slice(0, 8);
      }
    }

    const rows: HistoryRow[] = [];
    for (const row of auditRes.data || []) {
      rows.push({
        id: `audit-${row.id}`,
        userId: row.user_id || '—',
        userName: row.user_id ? nameMap[row.user_id] || row.user_id.slice(0, 8) : '—',
        action: row.action || 'update',
        performedOn: row.record_type || row.module || 'stock',
        at: row.created_at,
      });
    }
    for (const row of statusRes.data || []) {
      const from = row.from_status || '—';
      const to = row.to_status || '—';
      rows.push({
        id: `status-${row.id}`,
        userId: row.changed_by || '—',
        userName: row.changed_by ? nameMap[row.changed_by] || row.changed_by.slice(0, 8) : '—',
        action: row.note?.trim() || `${from} → ${to}`,
        performedOn: 'status',
        at: row.created_at,
      });
    }
    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setHistoryRows(rows);
    setHistoryLoading(false);
  }, []);

  const loadInvoices = useCallback(async (vehicleId: string) => {
    setInvoicesLoading(true);
    const { data: items, error: itemErr } = await supabase
      .from('invoice_items')
      .select('invoice_id, created_at')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    if (itemErr) {
      toast.error('Could not load invoices: ' + itemErr.message);
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    const invoiceIds = [...new Set((items || []).map((r) => r.invoice_id).filter(Boolean))];
    if (!invoiceIds.length) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    const { data: invRows, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)
      .order('issue_date', { ascending: false });
    if (invErr) {
      toast.error('Could not load invoices: ' + invErr.message);
      setInvoices([]);
    } else {
      const order = new Map(invoiceIds.map((id, i) => [id, i]));
      const sorted = ([...(invRows || [])] as Invoice[]).sort(
        (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
      );
      setInvoices(sorted);
    }
    setInvoicesLoading(false);
  }, []);

  const loadRemittances = useCallback(async (vehicleId: string) => {
    setRemittancesLoading(true);
    const { data, error } = await supabase
      .from('payment_allocations')
      .select(
        'id, payment_id, allocate_amount, sold_price, created_at, payments(id, payment_code, amount, currency, status, remitter_name, payment_date, remit_date)'
      )
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load remittances: ' + error.message);
      setRemittances([]);
      setRemittancesLoading(false);
      return;
    }
    const rows: RemittanceRow[] = [];
    for (const row of data || []) {
      const payRaw = row.payments as
        | {
            id?: string;
            payment_code?: string;
            amount?: number;
            currency?: string;
            status?: string;
            remitter_name?: string | null;
            payment_date?: string | null;
            remit_date?: string | null;
          }
        | {
            id?: string;
            payment_code?: string;
            amount?: number;
            currency?: string;
            status?: string;
            remitter_name?: string | null;
            payment_date?: string | null;
            remit_date?: string | null;
          }[]
        | null;
      const pay = Array.isArray(payRaw) ? payRaw[0] : payRaw;
      if (!pay?.id || pay.status === 'rejected') continue;
      rows.push({
        id: row.id,
        paymentId: pay.id,
        paymentCode: pay.payment_code || pay.id.slice(0, 8),
        allocateAmount: Number(row.allocate_amount) || Number(pay.amount) || 0,
        soldPrice: row.sold_price != null ? Number(row.sold_price) : null,
        currency: pay.currency || 'USD',
        status: pay.status || '—',
        remitterName: pay.remitter_name || null,
        paymentDate: pay.remit_date || pay.payment_date || null,
        createdAt: row.created_at,
      });
    }
    setRemittances(rows);
    setRemittancesLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !vehicle?.id) return;
    if (tab === 'history') void loadHistory(vehicle.id);
    if (tab === 'invoices') void loadInvoices(vehicle.id);
    if (tab === 'remittances') void loadRemittances(vehicle.id);
  }, [open, vehicle?.id, tab, loadHistory, loadInvoices, loadRemittances, remittanceReloadToken]);

  const openInvoicePreview = async (inv: Invoice) => {
    setPreviewInvoice(inv);
    setPreviewOpen(true);
    setPreviewLoading(true);
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('sort_order', { ascending: true });
    if (error) toast.error(`Could not load line items: ${error.message}`);
    setPreviewItems((data || []) as InvoiceItem[]);
    setPreviewLoading(false);
  };

  const detail = useMemo(() => {
    if (!vehicle) return null;
    const bid = vehicle.purchase_price != null ? Number(vehicle.purchase_price) : null;
    const expense = vehicle.expense_jpy == null ? FIXED_EXPENSE_JPY : Number(vehicle.expense_jpy) || 0;
    const tt = vehicle.tt_rate == null ? DEFAULT_TT_RATE : Number(vehicle.tt_rate) || DEFAULT_TT_RATE;
    const fobCalc = bid != null ? calcFobFromBid(bid, expense, tt) : null;
    const buyJpy =
      fobCalc && bid != null && Math.round(fobCalc.fobJpy) !== Math.round(bid) ? fobCalc.fobJpy : null;
    const fobUsd = publicFobUsd(vehicle);
    const listed = vehicle.listed_price != null ? Number(vehicle.listed_price) : null;
    const showWeb = listed != null && (fobUsd == null || Math.abs(listed - Number(fobUsd)) > 0.5);
    const country =
      vehicle.source_country || resolveSourceCountry(vehicle.source_country_code)?.name || '';
    const port = (vehicle.shipping_port_of_loading || '').trim();
    const yard = (vehicle.location || '').trim();
    const ccy = vehicle.listed_currency || 'USD';
    const purchaseCcy = vehicle.purchase_currency || 'JPY';
    return {
      bid,
      buyJpy,
      fobUsd,
      listed,
      showWeb,
      country,
      port,
      yard,
      ccy,
      purchaseCcy,
      fuel: vehicle.fuel_type ? vehicle.fuel_type.replace('_', ' ') : '',
      transmission: vehicle.transmission || '',
      mileage:
        vehicle.mileage_km != null ? `${Number(vehicle.mileage_km).toLocaleString()} km` : '',
      freight:
        vehicle.freight_mode === 'roro' || vehicle.freight_mode === 'container'
          ? FREIGHT_MODE_LABELS[vehicle.freight_mode]
          : '',
      profit: soldProfitUsd(vehicle),
      commission: commissionAmountPkr(vehicle),
    };
  }, [vehicle]);

  if (!vehicle) return null;

  const title = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.stock_number;
  const previewCustomer =
    previewInvoice?.customer_id
      ? customers.find((c) => c.id === previewInvoice.customer_id) || null
      : null;
  const previewIsAuction = previewInvoice ? isAuctionDepositInvoice(previewInvoice) : false;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent fullscreen>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {vehicle.stock_number} · {statusLabels[vehicle.status]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border sm:h-24 sm:w-32">
                {vehicle.primary_image_url ? (
                  <img src={vehicle.primary_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <CarFront className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={PAYMENT_STATUS_STYLES[effectivePaymentStatus(vehicle)]}>
                    {PAYMENT_STATUS_LABELS[effectivePaymentStatus(vehicle)]}
                  </Badge>
                  <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(vehicle)]}>
                    {SHIPPING_STATUS_LABELS[effectiveShippingStatus(vehicle)]}
                  </Badge>
                  {effectiveCommissionStatus(vehicle) === 'paid' ? (
                    <Badge className="border-emerald-600 bg-emerald-600 text-white">Commission paid</Badge>
                  ) : effectiveCommissionStatus(vehicle) === 'due' ? (
                    <Badge variant="outline" className="border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900">
                      Commission due
                    </Badge>
                  ) : null}
                </div>
                <ShippingStepper vehicle={vehicle} />
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">FOB</p>
                    <p className="font-semibold">
                      {detail?.fobUsd != null ? formatMoney(detail.fobUsd, detail.ccy) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Sold / term</p>
                    <p className="font-semibold">
                      {vehicle.sold_price != null
                        ? `${formatMoney(Number(vehicle.sold_price), detail?.ccy || 'USD')} ${vehicle.incoterm || ''}`
                        : vehicle.incoterm || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Freight</p>
                    <p className="font-semibold">{detail?.freight || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Profit</p>
                    <p className="font-semibold">
                      {detail?.profit != null ? formatMoney(detail.profit, detail.ccy) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Commission</p>
                    <p className="font-semibold">
                      {detail?.commission != null && Number(vehicle.commission_pkr) > 0
                        ? formatMoney(Number(vehicle.commission_pkr), 'PKR')
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canReserveStock && effectivePaymentStatus(vehicle) === 'available' ? (
                    <Button size="sm" onClick={onReserve}>
                      <Tag className="mr-1 h-3.5 w-3.5" />
                      Reserve
                    </Button>
                  ) : null}
                  {canEditVehicle ? (
                    <Button size="sm" variant="outline" onClick={onEdit}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit stock
                    </Button>
                  ) : null}
                  {canEditShipping ? (
                    <Button size="sm" variant="outline" onClick={onBooking}>
                      <Ship className="mr-1 h-3.5 w-3.5" />
                      Booking
                    </Button>
                  ) : null}
                  {canDeleteVehicle ? (
                    <Button size="sm" variant="outline" onClick={onDelete}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  ) : null}
                  {canMarkCommissionPaid && effectiveCommissionStatus(vehicle) === 'due' ? (
                    <Button size="sm" disabled={submitting} onClick={onMarkCommissionPaid}>
                      Mark commission paid
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background">
              <div className="border-b border-border px-3 py-3 sm:px-4">
                <PillTabs value={tab} onChange={setTab} />
              </div>
              <div className="p-3 sm:p-4">
                {tab === 'details' ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <SpecCard
                      label="Make / model / year"
                      value={[vehicle.make, vehicle.model, vehicle.model_year].filter(Boolean).join(' ')}
                    />
                    <SpecCard label="Grade" value={vehicle.model_grade} />
                    <SpecCard label="Chassis" value={vehicle.chassis_number} />
                    <SpecCard label="Stock #" value={vehicle.stock_number} />
                    <SpecCard label="Color" value={vehicle.color} />
                    <SpecCard label="Fuel" value={detail?.fuel} />
                    <SpecCard label="Transmission" value={detail?.transmission} />
                    <SpecCard label="Mileage" value={detail?.mileage} />
                    <SpecCard label="Source country" value={detail?.country} />
                    <SpecCard label="Port" value={detail?.port} />
                    <SpecCard label="Yard / location" value={detail?.yard} />
                    <SpecCard
                      label="Bid"
                      value={
                        detail?.bid != null ? formatMoney(detail.bid, detail.purchaseCcy) : '—'
                      }
                    />
                    <SpecCard
                      label="BUY"
                      value={
                        detail?.buyJpy != null ? formatMoney(detail.buyJpy, 'JPY') : '—'
                      }
                    />
                    <SpecCard
                      label="FOB"
                      value={
                        detail?.fobUsd != null ? formatMoney(detail.fobUsd, detail.ccy) : '—'
                      }
                    />
                    <SpecCard
                      label="WEB"
                      value={
                        detail?.showWeb && detail.listed != null
                          ? formatMoney(detail.listed, vehicle.listed_currency || 'USD')
                          : '—'
                      }
                    />
                    <SpecCard label="Agent" value={agentName} />
                    <SpecCard label="Customer" value={customerName} />
                    <SpecCard
                      label="Sold / term"
                      value={
                        vehicle.sold_price != null
                          ? `${formatMoney(Number(vehicle.sold_price), detail?.ccy || 'USD')} ${vehicle.incoterm || ''}`
                          : vehicle.incoterm || '—'
                      }
                    />
                    <SpecCard label="Freight" value={detail?.freight} />
                    <SpecCard
                      label="Profit"
                      value={
                        detail?.profit != null ? formatMoney(detail.profit, detail.ccy) : '—'
                      }
                    />
                    <SpecCard
                      label="Commission"
                      value={
                        detail?.commission != null && Number(vehicle.commission_pkr) > 0
                          ? formatMoney(Number(vehicle.commission_pkr), 'PKR')
                          : '—'
                      }
                    />
                  </div>
                ) : null}

                {tab === 'history' ? (
                  historyLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                    </p>
                  ) : historyRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No history.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[11px] uppercase tracking-wide">User ID</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">User name</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Action</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Performed on</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyRows.map((row, i) => (
                            <TableRow key={row.id} className={i % 2 === 1 ? 'bg-muted/40' : undefined}>
                              <TableCell className="text-sm font-mono text-muted-foreground">
                                {row.userId.length > 12 ? row.userId.slice(0, 8) : row.userId}
                              </TableCell>
                              <TableCell className="text-sm">{row.userName}</TableCell>
                              <TableCell className="text-sm">{row.action}</TableCell>
                              <TableCell className="text-sm">{row.performedOn}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {formatHistoryDate(row.at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : null}

                {tab === 'invoices' ? (
                  invoicesLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
                    </p>
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices.</p>
                  ) : (
                    <ul className="space-y-2">
                      {invoices.map((inv) => (
                        <li key={inv.id}>
                          <button
                            type="button"
                            onClick={() => void openInvoicePreview(inv)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{inv.invoice_code}</p>
                              <p className="text-xs text-muted-foreground">
                                {inv.issue_date ? isoDay(inv.issue_date) : '—'} · {inv.payment_status} ·{' '}
                                {formatMoney(Number(inv.total) || 0, inv.currency || 'USD')}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-primary">View PDF</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}

                {tab === 'remittances' ? (
                  remittancesLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading remittances…
                    </p>
                  ) : remittances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No remittances allocated.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[11px] uppercase tracking-wide">Payment</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Remitter</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Allocated</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Status</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wide">Date</TableHead>
                            {canDeallocateRemittance ? (
                              <TableHead className="text-[11px] uppercase tracking-wide"> </TableHead>
                            ) : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {remittances.map((row, i) => (
                            <TableRow key={row.id} className={i % 2 === 1 ? 'bg-muted/40' : undefined}>
                              <TableCell className="text-sm font-medium">{row.paymentCode}</TableCell>
                              <TableCell className="text-sm">{row.remitterName || '—'}</TableCell>
                              <TableCell className="text-sm">
                                {formatMoney(row.allocateAmount, row.currency)}
                              </TableCell>
                              <TableCell className="text-sm capitalize">{row.status}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">
                                {row.paymentDate
                                  ? isoDay(row.paymentDate)
                                  : formatHistoryDate(row.createdAt)}
                              </TableCell>
                              {canDeallocateRemittance ? (
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive"
                                    disabled={submitting}
                                    onClick={() =>
                                      onDeallocateRemittance?.({
                                        paymentId: row.paymentId,
                                        paymentCode: row.paymentCode,
                                        amount: row.allocateAmount,
                                        currency: row.currency,
                                        allocationId: row.id,
                                      })
                                    }
                                  >
                                    Deallocate
                                  </Button>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : null}

                {tab === 'documents' ? (
                  <VehicleShippingDocs
                    vehicleId={vehicle.id}
                    allowDelete={canEditShipping}
                    emptyLabel="No documents."
                    onChanged={onDocsChanged}
                  />
                ) : null}

                {tab === 'shipping' ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <SpecCard
                        label="Shipment status"
                        value={SHIPPING_STATUS_LABELS[effectiveShippingStatus(vehicle)].toUpperCase()}
                      />
                      <SpecCard
                        label="Shipment type"
                        value={
                          vehicle.freight_mode === 'roro' || vehicle.freight_mode === 'container'
                            ? FREIGHT_MODE_LABELS[vehicle.freight_mode]
                            : 'Not set'
                        }
                      />
                      <SpecCard label="BL #" value={vehicle.shipping_bl_number || 'Not set'} />
                      <SpecCard
                        label="Container #"
                        value={vehicle.shipping_container_number || 'Not set'}
                      />
                      <SpecCard label="ETD" value={isoDay(vehicle.shipping_etd) || 'Not set'} />
                      <SpecCard label="ETA" value={isoDay(vehicle.shipping_eta) || 'Not set'} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <SpecCard label="Courier" value={vehicle.courier_company || vehicle.courier_selection || 'Not set'} />
                      <SpecCard label="Tracking ID" value={vehicle.courier_tracking_id || 'Not set'} />
                      <SpecCard label="Courier date" value={isoDay(vehicle.courier_date) || 'Not set'} />
                      <SpecCard
                        label="Courier charges"
                        value={
                          vehicle.courier_charges != null
                            ? formatMoney(Number(vehicle.courier_charges), 'USD')
                            : 'Not set'
                        }
                      />
                      <SpecCard label="Port of loading" value={vehicle.shipping_port_of_loading || 'Not set'} />
                      <SpecCard
                        label="Port of discharge"
                        value={vehicle.shipping_port_of_discharge || 'Not set'}
                      />
                      <SpecCard label="Vessel" value={vehicle.shipping_vessel_name || 'Not set'} />
                      <SpecCard label="Booking #" value={vehicle.shipping_booking_number || 'Not set'} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Edit shipping and courier from Actions (Booking / Edit Shipping / Edit Courier) on the stock card.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent fullscreen className="print:max-w-none print:shadow-none print:border-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>
              {previewIsAuction ? 'Auction deposit invoice preview' : 'Commercial Invoice Preview'}
            </DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
            </p>
          ) : previewInvoice ? (
            <div className="overflow-x-auto print:overflow-visible">
              <div className="min-w-[720px] print:min-w-0">
                <CommercialInvoiceTemplate
                  invoice={previewInvoice}
                  items={previewItems}
                  customer={previewCustomer as Customer | null}
                  company={companyLetterhead}
                  vehicles={[vehicle]}
                  salesAgent={previewInvoice.sales_agent_name || null}
                  showQr
                  variant={previewIsAuction ? 'auction_deposit' : 'commercial'}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="print:hidden flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            {previewInvoice ? (
              <Button onClick={() => void printDocumentPdf(previewInvoice.invoice_code || 'Invoice')}>
                Print / PDF
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
