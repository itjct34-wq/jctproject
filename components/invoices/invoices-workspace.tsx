'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase/client';
import { fetchAllPages } from '@/lib/erp/paged-query';
import { exportToExcel } from '@/lib/utils/excel-export';
import { exportCommercialInvoiceExcel } from '@/lib/utils/commercial-invoice-excel';
import { exportCommercialInvoiceDocx } from '@/lib/utils/commercial-invoice-docx';
import { buildVerifyUrl } from '@/components/invoices/qr-code';
import { printDocumentPdf } from '@/lib/utils/print-document-pdf';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Switch } from '@/components/ui/switch';
import type { Invoice, InvoiceItem, Customer, Vehicle, CompanySettings } from '@/lib/types';
import { Download, ExternalLink, FileText, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, Printer, QrCode } from 'lucide-react';
import { CurrencySelect } from '@/components/ui/currency-select';
import { DEPOSIT_RATIOS, decodeInvoiceVehicle, describeInvoiceVehicle, formatTransmissionLabel, normalizeDepositRatio } from '@/lib/jct-official';
import { customerContactErrorMessage, isInvoiceConsigneeComplete } from '@/lib/utils/customer-contact';
import {
  freightValidationError,
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';
import { incotermSelectOptions } from '@/lib/vehicle-lifecycle';
import { formatCurrency } from '@/lib/utils/currencies';
import { sumByCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  invoiceOpenHref,
  isAuctionDepositInvoice,
} from '@/lib/invoice-links';

const DocumentPrintPreview = dynamic(
  () => import('@/components/documents/document-print-preview').then((m) => m.DocumentPrintPreview),
  { ssr: false }
);
const CommercialInvoiceTemplate = dynamic(
  () => import('@/components/invoices/commercial-invoice-template').then((m) => m.CommercialInvoiceTemplate),
  { ssr: false }
);

export type InvoiceWorkspaceKind = 'commercial' | 'auction';
export { invoiceOpenHref, invoiceOpenHrefByCode, isAuctionDepositInvoice } from '@/lib/invoice-links';

const AUCTION_DEPOSIT_TERMS = 'AUCTION DEPOSIT';

const statusChipClass: Record<Invoice['payment_status'], string> = {
  unpaid: 'erp-chip-danger',
  partial: 'erp-chip-warning',
  paid: 'erp-chip-success',
  cancelled: 'erp-chip-neutral',
  credited: 'erp-chip-info',
};
const typeChipClass: Record<Invoice['invoice_type'], string> = {
  commercial: 'erp-chip-type',
  proforma: 'erp-chip-type-muted',
  credit_note: 'erp-chip-info',
};
const typeLabels: Record<Invoice['invoice_type'], string> = { proforma: 'Proforma', commercial: 'Commercial', credit_note: 'Credit Note' };
const emptyForm = {
  customer_mode: 'manual' as 'existing' | 'manual',
  customer_id: '', sale_id: '', invoice_type: 'proforma' as Invoice['invoice_type'],
  invoice_code_mode: 'auto' as 'auto' | 'manual', invoice_code: '',
  issue_date: '', due_date: '', tax: '', currency: 'USD', notes: '',
  incoterms: 'FOB', shipment_type: 'RORO', container_mode: 'RORO',
  port_of_loading: 'Nagoya, Japan', port_of_discharge: '', vessel_name: '', bl_number: '',
  freight_total: '0', freight_notes: 'Ocean freight', insurance_total: '0', other_charges: '0', discount_total: '0',
  payment_terms: '100% T/T in advance / LC at sight', bank_details: '',
  sales_agent: '',
  payment_status: 'unpaid' as Invoice['payment_status'],
  guest_name: '', guest_company: '', guest_email: '', guest_phone: '',
  guest_country: '', guest_city: '', guest_address: '',
};
type LineDraft = {
  description: string; quantity: string; unit_price: string; discount: string; vehicle_id: string;
  chassis_number: string; stock_number: string; make: string; model: string; colour: string;
  year: string; engine: string; transmission: string;
};
function emptyLine(kind: InvoiceWorkspaceKind): LineDraft {
  return {
    description: '', quantity: '1', unit_price: '', discount: kind === 'auction' ? '' : '30', vehicle_id: '',
    chassis_number: '', stock_number: '', make: '', model: '', colour: '',
    year: '', engine: '', transmission: '',
  };
}

function defaultPaymentTerms(kind: InvoiceWorkspaceKind) {
  return kind === 'auction' ? AUCTION_DEPOSIT_TERMS : '100% T/T in advance / LC at sight';
}

export function InvoicesWorkspace({ kind }: { kind: InvoiceWorkspaceKind }) {
  const { profile } = useAuth();
  const { can, isSellingFocused } = usePermissions();
  const canCreateInvoice = can('invoices', 'create');
  const canEditInvoice = can('invoices', 'edit');
  const canDeleteInvoice = can('invoices', 'delete');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineDraft[]>([]);
  const isAuction = kind === 'auction';
  const [companySettings, setCompanySettings] = useState<Pick<
    CompanySettings,
    'id' | 'invoice_prefix' | 'invoice_next_number' | 'company_name' | 'legal_name' | 'logo_url' | 'hanko_url'
  > | null>(null);
  const [printShowQr, setPrintShowQr] = useState(true);
  const [vesselOptions, setVesselOptions] = useState<string[]>([]);
  const deepLinkHandled = useRef<string | null>(null);

  useEffect(() => {
    void supabase
      .from('vessels')
      .select('name')
      .eq('status', 'active')
      .order('name')
      .limit(300)
      .then(({ data }) => {
        setVesselOptions((data || []).map((r: { name: string }) => r.name).filter(Boolean));
      });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes, vRes, setRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(500),
      fetchAllPages<Customer>((from, to) =>
        supabase
          .from('customers')
          .select(
            'id, full_name, customer_code, company_name, email, phone, whatsapp, country, city, address_line1, address_line2, port_of_discharge'
          )
          .order('full_name')
          .range(from, to)
      ),
      fetchAllPages<Vehicle>((from, to) =>
        supabase
          .from('vehicles')
          .select(
            'id, stock_number, make, model, chassis_number, color, listed_price, fob_usd, sold_price, model_year, transmission'
          )
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      supabase
        .from('company_settings')
        .select('id, invoice_prefix, invoice_next_number, company_name, legal_name, logo_url, hanko_url')
        .limit(1)
        .maybeSingle(),
    ]);
    if (iRes.error) toast.error(`Unable to load invoices: ${iRes.error.message}`);
    else setInvoices((iRes.data || []) as Invoice[]);
    if (cRes.error) toast.error(`Unable to load customers: ${cRes.error.message}`);
    else setCustomers(cRes.data);
    if (vRes.error) toast.error(`Unable to load vehicles: ${vRes.error.message}`);
    else setVehicles(vRes.data);
    if (setRes.data) {
      setCompanySettings(
        setRes.data as Pick<
          CompanySettings,
          'id' | 'invoice_prefix' | 'invoice_next_number' | 'company_name' | 'legal_name' | 'logo_url' | 'hanko_url'
        >
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Keep search box in sync when arriving via ?q= from stock / deep links.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) setSearch(q);
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesKind = isAuction ? isAuctionDepositInvoice(inv) : !isAuctionDepositInvoice(inv);
      const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;
      const matchesSearch = !q || [inv.invoice_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesKind && matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter, isAuction]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';

  const nextAutoInvoiceCode = () => {
    const prefix = (companySettings?.invoice_prefix || 'JCT').replace(/-+$/, '');
    const n = companySettings?.invoice_next_number || 1;
    return isAuction ? `${prefix}-AD-${String(n).padStart(4, '0')}` : `${prefix}-${String(n).padStart(4, '0')}`;
  };

  const bumpInvoiceNumber = async () => {
    if (!companySettings) return;
    const next = (companySettings.invoice_next_number || 1) + 1;
    await supabase.from('company_settings').update({ invoice_next_number: next }).eq('id', companySettings.id);
    setCompanySettings({ ...companySettings, invoice_next_number: next });
  };

  const applyVehicle = (idx: number, vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    const next = [...lineItems];
    if (!v) {
      next[idx] = { ...next[idx], vehicle_id: '' };
      setLineItems(next);
      return;
    }
    const stockCost = v.sold_price ?? v.fob_usd ?? v.listed_price ?? null;
    const currentCost = Number(next[idx].unit_price);
    const shouldPrefillCost = !next[idx].unit_price.trim() || !Number.isFinite(currentCost) || currentCost === 0;
    next[idx] = {
      ...next[idx],
      vehicle_id: v.id,
      chassis_number: v.chassis_number || '',
      stock_number: v.stock_number || '',
      make: v.make || '',
      model: v.model || '',
      colour: v.color || '',
      year: v.model_year != null ? String(v.model_year) : '',
      engine: next[idx].engine || '',
      transmission: formatTransmissionLabel(v.transmission),
      unit_price: shouldPrefillCost && stockCost != null ? String(stockCost) : next[idx].unit_price,
    };
    setLineItems(next);
  };

  const calcSubtotal = (items: Array<{ quantity: string; unit_price: string }>) =>
    Math.round(
      items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return sum + qty * price;
      }, 0)
    );

  const fetchInvoiceItems = async (inv: Invoice) => {
    setSelected(inv);
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
      .order('sort_order', { ascending: true });
    if (error) toast.error(`Could not load line items: ${error.message}`);
    const loaded = (data || []) as InvoiceItem[];
    setItems(loaded);
    return loaded;
  };

  /** Load line items and open the commercial invoice print/PDF preview. */
  const openPrintPreview = async (inv: Invoice) => {
    // Set selected + items before opening so preview never flashes empty / broken.
    await fetchInvoiceItems(inv);
    setPrintOpen(true);
  };

  // Stock INV chip / "Open invoice" links use ?id= to open print preview for that invoice.
  useEffect(() => {
    if (loading) return;
    const id = searchParams.get('id');
    if (!id || deepLinkHandled.current === id) return;

    const inv = invoices.find((i) => i.id === id);
    if (!inv) {
      if (invoices.length > 0) {
        deepLinkHandled.current = id;
        toast.error('Invoice not found or not visible with your permissions');
      }
      return;
    }

    if (isAuctionDepositInvoice(inv) !== isAuction) {
      deepLinkHandled.current = id;
      router.replace(invoiceOpenHref(inv));
      return;
    }

    deepLinkHandled.current = id;
    setSearch(inv.invoice_code);
    void openPrintPreview(inv);
  }, [loading, invoices, searchParams, isAuction, router]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      invoice_code_mode: 'auto',
      invoice_code: nextAutoInvoiceCode(),
      payment_terms: defaultPaymentTerms(kind),
      payment_status: 'unpaid',
    });
    setLineItems([{ ...emptyLine(kind) }]);
    setCreateOpen(true);
  };

  // Quick action / deep link: ?new=1 opens the create invoice sheet.
  useEffect(() => {
    if (loading) return;
    if (searchParams.get('new') !== '1') return;
    if (!canCreateInvoice) return;
    if (deepLinkHandled.current === 'new') return;
    deepLinkHandled.current = 'new';
    openCreate();
    const next = new URLSearchParams(searchParams.toString());
    next.delete('new');
    const qs = next.toString();
    const path = isAuction ? '/auction-invoices' : '/invoices';
    router.replace(qs ? `${path}?${qs}` : path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, canCreateInvoice, router, isAuction]);
  const openEditForInvoice = async (inv: Invoice) => {
    const loadedItems = await fetchInvoiceItems(inv);
    const editPolicy = resolveFreightPolicy({
      incoterm: inv.incoterms || 'FOB',
      shipmentType: inv.shipment_type || 'RORO',
      containerMode: inv.container_mode || 'RORO',
    });
    setForm({
      customer_mode: 'existing',
      guest_name: '', guest_company: '', guest_email: '', guest_phone: '',
      guest_country: '', guest_city: '', guest_address: '',
      customer_id: inv.customer_id, sale_id: inv.sale_id || '', invoice_type: inv.invoice_type,
      invoice_code_mode: 'manual', invoice_code: inv.invoice_code,
      issue_date: inv.issue_date, due_date: inv.due_date || '', tax: String(inv.tax),
      currency: inv.currency, notes: inv.notes || '',
      incoterms: inv.incoterms || 'FOB', shipment_type: inv.shipment_type || 'RORO',
      container_mode: inv.container_mode === 'RORO Vessel' ? 'RORO' : (inv.container_mode || 'RORO'),
      port_of_loading: inv.port_of_loading || 'Nagoya, Japan',
      port_of_discharge: inv.port_of_discharge || '', vessel_name: inv.vessel_name || '',
      bl_number: inv.bl_number || '',
      freight_total: String(normalizeFreightAmount(editPolicy, inv.freight_total)),
      freight_notes: normalizeFreightNotes(editPolicy, inv.freight_notes) || '',
      insurance_total: String(inv.insurance_total ?? 0),
      other_charges: String(inv.other_charges ?? 0), discount_total: String(inv.discount_total ?? 0),
      payment_terms: inv.payment_terms || defaultPaymentTerms(kind),
      bank_details: inv.bank_details || '',
      sales_agent: inv.sales_agent_name || '',
      payment_status: inv.payment_status,
    });
    setLineItems(loadedItems.map((i) => {
      const v = vehicles.find((x) => x.id === i.vehicle_id);
      const bits = decodeInvoiceVehicle(i.description);
      return {
        description: bits.notes || '',
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
        discount: isAuction ? String(i.discount ?? 0) : String(normalizeDepositRatio(i.discount, i.unit_price)),
        vehicle_id: i.vehicle_id || '',
        chassis_number: bits.chassis_number || v?.chassis_number || '',
        stock_number: bits.stock_number || v?.stock_number || '',
        make: bits.make || v?.make || '',
        model: bits.model || v?.model || '',
        colour: bits.colour || v?.color || '',
        year: bits.year || (v?.model_year != null ? String(v.model_year) : ''),
        engine: bits.engine || '',
        transmission: bits.transmission || formatTransmissionLabel(v?.transmission),
      };
    }));
    if (loadedItems.length === 0) setLineItems([{ ...emptyLine(kind) }]);
    setEditOpen(true);
  };

  const openDeleteForInvoice = (inv: Invoice) => {
    setSelected(inv);
    setDeleteOpen(true);
  };

  const resolveCustomerId = async () => {
    if (form.customer_mode === 'existing') {
      if (!form.customer_id) {
        toast.error('Select a customer, or enter customer details');
        return null;
      }
      return form.customer_id;
    }
    if (!profile) return null;
    const name = form.guest_name.trim();
    const email = form.guest_email.trim();
    const phone = form.guest_phone.trim();
    const address = form.guest_address.trim();
    const missing = isInvoiceConsigneeComplete({ full_name: name, email, phone, address_line1: address });
    if (missing) {
      toast.error(missing);
      return null;
    }
    const payload = {
      full_name: name,
      company_name: form.guest_company.trim() || null,
      email: email || null,
      phone: phone || null,
      country: form.guest_country.trim() || null,
      city: form.guest_city.trim() || null,
      address_line1: address,
      customer_type: form.guest_company.trim() ? 'company' : 'individual',
      status: 'active',
      created_by: profile.id,
      assigned_to: profile.id,
    };
    const { data, error } = await supabase.from('customers').insert(payload).select().maybeSingle();
    if (!error && data) {
      const created = data as Customer;
      setCustomers((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      return created.id;
    }
    if (error?.code === '23505' && email) {
      const { data: existing } = await supabase.from('customers').select('*').ilike('email', email).maybeSingle();
      if (existing) {
        const found = existing as Customer;
        setCustomers((prev) => (prev.some((c) => c.id === found.id) ? prev : [...prev, found]));
        toast.message('Used the existing customer with that email');
        return found.id;
      }
    }
    if (error?.code === '23505' && phone) {
      const { data: existing } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
      if (existing) {
        const found = existing as Customer;
        setCustomers((prev) => (prev.some((c) => c.id === found.id) ? prev : [...prev, found]));
        toast.message('Used the existing customer with that phone');
        return found.id;
      }
    }
    toast.error(customerContactErrorMessage(error));
    return null;
  };

  const linePayload = (invoiceId: string) =>
    lineItems
      .filter((i) => i.description.trim() || i.vehicle_id || i.chassis_number.trim() || i.make.trim() || i.stock_number.trim() || i.colour.trim() || i.year.trim() || i.engine.trim() || i.transmission.trim())
      .map((item, idx) => ({
        invoice_id: invoiceId,
        vehicle_id: item.vehicle_id || null,
        description: describeInvoiceVehicle({ ...item, notes: item.description }),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount: isAuction
          ? Number(item.discount) || 0
          : normalizeDepositRatio(Number(item.discount) || 0, Number(item.unit_price) || 0),
        line_total: Math.round((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)),
        sort_order: idx,
      }));

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateInvoice) {
      toast.error('You do not have permission to create invoices');
      return;
    }
    if (!profile) return;
    const customerId = await resolveCustomerId();
    if (!customerId) return;
    const policy = resolveFreightPolicy({
      incoterm: form.incoterms,
      shipmentType: form.shipment_type,
      containerMode: form.container_mode,
    });
    const freightErr = freightValidationError(policy, form.freight_total);
    if (freightErr) {
      toast.error(freightErr);
      return;
    }
    setSubmitting(true);
    const subtotal = calcSubtotal(lineItems);
    const tax = 0;
    const freight = normalizeFreightAmount(policy, form.freight_total);
    const freightNotes = normalizeFreightNotes(policy, form.freight_notes);
    const insurance = Math.round(Number(form.insurance_total) || 0);
    const other = Math.round(Number(form.other_charges) || 0);
    const discount = Math.round(Number(form.discount_total) || 0);
    const total = Math.round(subtotal + tax + freight + insurance + other - discount);
    const invoiceCode = form.invoice_code.trim() || nextAutoInvoiceCode();
    const paymentTerms = isAuction
      ? ((form.payment_terms || AUCTION_DEPOSIT_TERMS).toUpperCase().startsWith(AUCTION_DEPOSIT_TERMS)
          ? (form.payment_terms || AUCTION_DEPOSIT_TERMS)
          : `${AUCTION_DEPOSIT_TERMS} — ${form.payment_terms}`)
      : (form.payment_terms || null);
    const { data, error } = await supabase.from('invoices').insert({ invoice_code: invoiceCode, customer_id: customerId, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date || new Date().toISOString().split('T')[0], due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, payment_status: form.payment_status, notes: form.notes.trim() || null, incoterms: form.incoterms || 'FOB', shipment_type: form.shipment_type || 'RORO', container_mode: form.container_mode || (form.shipment_type === 'Container' ? '40ft Container' : 'RORO'), port_of_loading: form.port_of_loading || 'Nagoya, Japan', port_of_discharge: form.port_of_discharge || null, vessel_name: form.vessel_name || null, bl_number: form.bl_number || null, freight_total: freight, freight_notes: freightNotes, insurance_total: insurance, other_charges: other, discount_total: discount, payment_terms: paymentTerms, bank_details: form.bank_details || null, sales_agent_name: form.sales_agent.trim() || null, created_by: profile.id }).select().maybeSingle();
    if (error) { setSubmitting(false); toast.error(`Could not create invoice: ${error.message}`); return; }
    const inv = data as Invoice;
    const itemRows = linePayload(inv.id);
    if (itemRows.length > 0) {
      const { error: itemError } = await supabase.from('invoice_items').insert(itemRows);
      if (itemError) toast.error(`Invoice created but line items failed: ${itemError.message}`);
    }
    if (form.invoice_code_mode === 'auto') await bumpInvoiceNumber();
    setSubmitting(false); toast.success(isAuction ? 'Auction deposit invoice created' : 'Invoice created'); setForm({ ...emptyForm, payment_terms: defaultPaymentTerms(kind) }); setLineItems([{ ...emptyLine(kind) }]); setCreateOpen(false); loadData();
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!canEditInvoice) {
      toast.error('You do not have permission to edit invoices');
      return;
    }
    const policy = resolveFreightPolicy({
      incoterm: form.incoterms,
      shipmentType: form.shipment_type,
      containerMode: form.container_mode,
    });
    const freightErr = freightValidationError(policy, form.freight_total);
    if (freightErr) {
      toast.error(freightErr);
      return;
    }
    setSubmitting(true);
    const subtotal = calcSubtotal(lineItems);
    const tax = 0;
    const freight = normalizeFreightAmount(policy, form.freight_total);
    const freightNotes = normalizeFreightNotes(policy, form.freight_notes);
    const insurance = Math.round(Number(form.insurance_total) || 0);
    const other = Math.round(Number(form.other_charges) || 0);
    const discount = Math.round(Number(form.discount_total) || 0);
    const total = Math.round(subtotal + tax + freight + insurance + other - discount);
    const customerId = await resolveCustomerId();
    if (!customerId) { setSubmitting(false); return; }
    const paymentTerms = isAuction
      ? ((form.payment_terms || AUCTION_DEPOSIT_TERMS).toUpperCase().startsWith(AUCTION_DEPOSIT_TERMS)
          ? (form.payment_terms || AUCTION_DEPOSIT_TERMS)
          : `${AUCTION_DEPOSIT_TERMS} — ${form.payment_terms}`)
      : (form.payment_terms || null);
    const { error } = await supabase.from('invoices').update({ invoice_code: form.invoice_code.trim() || selected.invoice_code, customer_id: customerId, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date, due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, notes: form.notes.trim() || null, incoterms: form.incoterms || 'FOB', shipment_type: form.shipment_type || 'RORO', container_mode: form.container_mode || (form.shipment_type === 'Container' ? '40ft Container' : 'RORO'), port_of_loading: form.port_of_loading || 'Nagoya, Japan', port_of_discharge: form.port_of_discharge || null, vessel_name: form.vessel_name || null, bl_number: form.bl_number || null, freight_total: freight, freight_notes: freightNotes, insurance_total: insurance, other_charges: other, discount_total: discount, payment_terms: paymentTerms, bank_details: form.bank_details || null, sales_agent_name: form.sales_agent.trim() || null, payment_status: form.payment_status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { setSubmitting(false); toast.error(`Could not update: ${error.message}`); return; }
    const { error: delError } = await supabase.from('invoice_items').delete().eq('invoice_id', selected.id);
    if (delError) { setSubmitting(false); toast.error(`Could not update line items: ${delError.message}`); return; }
    const itemRows = linePayload(selected.id);
    if (itemRows.length > 0) {
      const { error: insError } = await supabase.from('invoice_items').insert(itemRows);
      if (insError) toast.error(`Line items failed to save: ${insError.message}`);
    }
    setSubmitting(false);
    const { data: fresh } = await supabase.from('invoices').select('*').eq('id', selected.id).maybeSingle();
    const updated = (fresh || { ...selected, subtotal, tax, total }) as Invoice;
    setSelected(updated); setInvoices((list) => list.map((i) => i.id === updated.id ? updated : i));
    await fetchInvoiceItems(updated);
    toast.success('Invoice updated');
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    if (!canDeleteInvoice) {
      toast.error('You do not have permission to delete invoices');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('invoices').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Invoice deleted'); setDeleteOpen(false); setSelected(null); setItems([]); loadData();
  };

  const handleExport = async () => {
    const rows = filtered.map((i) => ({ code: i.invoice_code, customer: customerName(i.customer_id), type: typeLabels[i.invoice_type], issue: format(new Date(i.issue_date), 'yyyy-MM-dd'), due: i.due_date ? format(new Date(i.due_date), 'yyyy-MM-dd') : '', subtotal: i.subtotal, total: i.total, currency: i.currency, status: i.payment_status }));
    await exportToExcel('invoices-export', 'Invoices', [
      { header: 'Invoice #', key: 'code', width: 18 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Type', key: 'type', width: 14 }, { header: 'Issue Date', key: 'issue', width: 14 }, { header: 'Due Date', key: 'due', width: 14 }, { header: 'Subtotal', key: 'subtotal', width: 14, format: '#,##0' }, { header: 'Total', key: 'total', width: 14, format: '#,##0' }, { header: 'Currency', key: 'currency', width: 10 }, { header: 'Status', key: 'status', width: 12 },
    ], rows, { title: 'Invoice Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length) } });
    toast.success('Invoices exported');
  };

  const closePrintPreview = (open: boolean) => {
    setPrintOpen(open);
    if (!open && !editOpen && !deleteOpen) {
      setSelected(null);
      setItems([]);
    }
  };

  const exportCommercialExcel = async () => {
    if (!selected) return;
    const cust = customers.find((c) => c.id === selected.customer_id) || null;
    const verifyUrl = selected.verification_token ? buildVerifyUrl(selected.verification_token) : undefined;
    await exportCommercialInvoiceExcel({ invoice: selected, items, customer: cust, verifyUrl });
    toast.success('Commercial invoice Excel downloaded');
  };

  const copyVerifyLink = () => {
    if (!selected?.verification_token) { toast.error('No verification token on this invoice'); return; }
    navigator.clipboard.writeText(buildVerifyUrl(selected.verification_token));
    toast.success('Verification link copied');
  };

  const openVerifyLink = () => {
    if (!selected?.verification_token) {
      toast.error('No verification token on this invoice');
      return;
    }
    window.open(buildVerifyUrl(selected.verification_token), '_blank', 'noopener,noreferrer');
  };

  const kindInvoices = invoices.filter((inv) => (isAuction ? isAuctionDepositInvoice(inv) : !isAuctionDepositInvoice(inv)));
  const stats = { total: kindInvoices.length, unpaid: kindInvoices.filter((i) => i.payment_status === 'unpaid').length, paid: kindInvoices.filter((i) => i.payment_status === 'paid').length, outstanding: kindInvoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + i.total, 0) };
  const receivablesByCurrency = sumByCurrency(
    kindInvoices
      .filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial')
      .map((i) => ({ amount: Number(i.total) || 0, currency: i.currency }))
  );

  const selectedCustomer = customers.find((c) => c.id === form.customer_id) || null;
  const freightPolicy = useMemo(
    () =>
      resolveFreightPolicy({
        incoterm: form.incoterms,
        shipmentType: form.shipment_type,
        containerMode: form.container_mode,
      }),
    [form.incoterms, form.shipment_type, form.container_mode]
  );
  const canSaveInvoice =
    form.customer_mode === 'manual'
      ? !isInvoiceConsigneeComplete({
          full_name: form.guest_name,
          email: form.guest_email,
          phone: form.guest_phone,
          address_line1: form.guest_address,
        })
      : Boolean(form.customer_id);

  const applyShippingPatch = (patch: Partial<typeof emptyForm>) => {
    const next = { ...form, ...patch };
    const policy = resolveFreightPolicy({
      incoterm: next.incoterms,
      shipmentType: next.shipment_type,
      containerMode: next.container_mode,
    });
    if (!policy.allowFreight) {
      next.freight_total = '0';
      next.freight_notes = '';
    } else if (!next.freight_notes.trim() || next.freight_notes === 'Container freight') {
      next.freight_notes = policy.defaultFreightLabel;
    }
    setForm(next);
  };

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    const next = [...lineItems];
    next[idx] = { ...next[idx], ...patch };
    setLineItems(next);
  };

  const lineItemForm = (isOpen: boolean, onClose: () => void, onSubmit: (e: React.FormEvent) => void, title: string) => (
    <Dialog open={isOpen} onOpenChange={onClose}><DialogContent fullscreen><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="erp-invoice-workform">
        <div className="erp-invoice-workform-body">
        {/* 1. Customer — one box; no VAT / tax fields */}
        <section className="shrink-0 space-y-2 rounded-md border border-border/60 p-2">
          <p className="text-sm font-semibold leading-none">Customer</p>
          <div className="space-y-0.5">
            <Label>Saved customer</Label>
            <Select
              value={form.customer_mode === 'manual' ? '__manual__' : (form.customer_id || undefined)}
              onValueChange={(v) => {
                if (v === '__manual__') {
                  setForm({ ...form, customer_mode: 'manual', customer_id: '' });
                  return;
                }
                const c = customers.find((x) => x.id === v);
                setForm({
                  ...form,
                  customer_mode: 'existing',
                  customer_id: v,
                  guest_name: c?.full_name || '',
                  guest_company: c?.company_name || '',
                  guest_email: c?.email || '',
                  guest_phone: c?.phone || '',
                  guest_country: c?.country || '',
                  guest_city: c?.city || '',
                  guest_address: c?.address_line1 || '',
                  port_of_discharge: c?.port_of_discharge || form.port_of_discharge,
                });
              }}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Enter customer manually" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Enter customer manually</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}{c.customer_code ? ` · ${c.customer_code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.customer_mode === 'existing' && selectedCustomer && (
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {selectedCustomer.full_name}
              {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
              {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
              {' · '}
              {[selectedCustomer.address_line1, selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ') || 'No address'}
            </p>
          )}
          {form.customer_mode === 'manual' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-0.5">
                <Label>Contact name *</Label>
                <Input className="h-9 text-sm" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="Contact name" required />
              </div>
              <div className="space-y-0.5">
                <Label>Company</Label>
                <Input className="h-9 text-sm" value={form.guest_company} onChange={(e) => setForm({ ...form, guest_company: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-0.5">
                <Label>Email</Label>
                <Input className="h-9 text-sm" type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} placeholder="Email (or phone)" />
              </div>
              <div className="space-y-0.5">
                <Label>Phone</Label>
                <Input className="h-9 text-sm" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="Phone (or email)" />
              </div>
              <div className="space-y-0.5 sm:col-span-2">
                <Label>Billing address *</Label>
                <Textarea
                  className="min-h-[3.5rem] text-sm"
                  value={form.guest_address}
                  onChange={(e) => setForm({ ...form, guest_address: e.target.value })}
                  placeholder="Shipping / billing address"
                  required
                />
              </div>
              <div className="space-y-0.5">
                <Label>City</Label>
                <Input className="h-9 text-sm" value={form.guest_city} onChange={(e) => setForm({ ...form, guest_city: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-0.5">
                <Label>Country</Label>
                <Input className="h-9 text-sm" value={form.guest_country} onChange={(e) => setForm({ ...form, guest_country: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          )}
        </section>

        {/* 2. Invoice essentials only */}
        <section className="shrink-0 space-y-2 rounded-md border border-border/60 p-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-0.5">
              <Label>{form.invoice_code_mode === 'auto' ? 'Invoice # (auto)' : 'Invoice #'}</Label>
              <div className="flex gap-1">
                <Input
                  className="h-9 text-sm"
                  value={form.invoice_code}
                  onChange={(e) => setForm({ ...form, invoice_code: e.target.value, invoice_code_mode: 'manual' })}
                  placeholder="INV0003"
                />
                {form.invoice_code_mode === 'manual' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-2 text-xs"
                    onClick={() => setForm({ ...form, invoice_code_mode: 'auto', invoice_code: nextAutoInvoiceCode() })}
                  >
                    Auto
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-0.5">
              <Label>Type</Label>
              <Select value={form.invoice_type} onValueChange={(v: Invoice['invoice_type']) => setForm({ ...form, invoice_type: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proforma">Proforma</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="credit_note">Credit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label>Currency</Label>
              <CurrencySelect value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} className="h-9 text-sm" />
            </div>
            <div className="space-y-0.5">
              <Label>Issue date</Label>
              <Input className="h-9 text-sm" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </div>
          </div>
        </section>

        {/* 3. Line items — description + qty + price only (no VAT) */}
        <section className="space-y-2 rounded-md border border-border/60 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold leading-none">Line items</p>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => setLineItems([...lineItems, { ...emptyLine(kind) }])}>
              <Plus className="h-3.5 w-3.5" />Add line
            </Button>
          </div>
          <div className="hidden gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_5.5rem_2rem]">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>{isAuction ? 'Deposit' : 'Deposit %'}</span>
            <span className="sr-only">Remove</span>
          </div>
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <div key={idx} className="grid gap-2 rounded-md border border-border/50 bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_5.5rem_2rem] sm:items-start">
                <div className="space-y-1.5 min-w-0">
                  <Select value={item.vehicle_id || 'none'} onValueChange={(v) => applyVehicle(idx, v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Stock link" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Manual line / no stock link</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.stock_number} · {v.make} {v.model} · {v.chassis_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    className="min-h-[4.5rem] resize-y rounded-md text-sm"
                    value={item.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    placeholder="Select a stock reference above or enter vehicle/part details"
                  />
                  {(item.make || item.model || item.chassis_number) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[item.make, item.model].filter(Boolean).join(' ')}
                      {item.chassis_number ? ` · ${item.chassis_number}` : ''}
                      {item.stock_number ? ` · ${item.stock_number}` : ''}
                    </p>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer select-none text-muted-foreground">Vehicle details</summary>
                    <div className="mt-1.5 grid gap-1.5 rounded-md border border-border/50 bg-muted/20 p-2 sm:grid-cols-3">
                      <Input className="h-8 rounded-md text-xs" value={item.make} onChange={(e) => updateLine(idx, { make: e.target.value, vehicle_id: '' })} placeholder="Make" />
                      <Input className="h-8 rounded-md text-xs" value={item.model} onChange={(e) => updateLine(idx, { model: e.target.value, vehicle_id: '' })} placeholder="Model" />
                      <Input className="h-8 rounded-md text-xs" value={item.chassis_number} onChange={(e) => updateLine(idx, { chassis_number: e.target.value, vehicle_id: '' })} placeholder="Chassis" />
                      <Input className="h-8 rounded-md text-xs" value={item.stock_number} onChange={(e) => updateLine(idx, { stock_number: e.target.value, vehicle_id: '' })} placeholder="Stock no." />
                      <Input className="h-8 rounded-md text-xs" value={item.year} onChange={(e) => updateLine(idx, { year: e.target.value, vehicle_id: '' })} placeholder="Year" />
                      <Input className="h-8 rounded-md text-xs" value={item.colour} onChange={(e) => updateLine(idx, { colour: e.target.value, vehicle_id: '' })} placeholder="Colour" />
                      <Input className="h-8 rounded-md text-xs" value={item.engine} onChange={(e) => updateLine(idx, { engine: e.target.value, vehicle_id: '' })} placeholder="Engine" />
                      <Input className="h-8 rounded-md text-xs" value={item.transmission} onChange={(e) => updateLine(idx, { transmission: e.target.value, vehicle_id: '' })} placeholder="Transmission" />
                    </div>
                  </details>
                </div>
                <div className="space-y-0.5">
                  <Label className="sm:sr-only">Qty</Label>
                  <Input className="h-9 text-sm" type="number" min={1} value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                </div>
                <div className="space-y-0.5">
                  <Label className="sm:sr-only">Unit price</Label>
                  <Input className="h-9 text-sm" type="number" value={item.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-0.5">
                  <Label className="sm:sr-only">{isAuction ? 'Deposit' : 'Deposit %'}</Label>
                  {isAuction ? (
                    <Input className="h-9 text-sm" type="number" value={item.discount} onChange={(e) => updateLine(idx, { discount: e.target.value })} placeholder="0" />
                  ) : (
                    <Select value={item.discount || '30'} onValueChange={(v) => updateLine(idx, { discount: v })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPOSIT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio} value={String(ratio)}>{ratio}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-start justify-end pt-0.5">
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} aria-label="Remove line">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="text-muted-foreground">Subtotal <span className="font-medium text-foreground">{form.currency} {(calcSubtotal(lineItems) + (freightPolicy.rollFreightIntoVehicleCost ? (Number(form.freight_total)||0) : 0)).toLocaleString()}</span></span>
              {isAuction && (
                <span className="text-muted-foreground">Deposit <span className="font-medium text-foreground">{form.currency} {lineItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0).toLocaleString()}</span></span>
              )}
              {freightPolicy.allowFreight && !freightPolicy.rollFreightIntoVehicleCost && (
                <span className="text-muted-foreground">Freight <span className="font-medium text-foreground">{form.currency} {(Number(form.freight_total)||0).toLocaleString()}</span></span>
              )}
              {((Number(form.insurance_total)||0)+(Number(form.other_charges)||0)) > 0 && (
                <span className="text-muted-foreground">Other <span className="font-medium text-foreground">{form.currency} {((Number(form.insurance_total)||0)+(Number(form.other_charges)||0)).toLocaleString()}</span></span>
              )}
              {(Number(form.discount_total)||0) > 0 && (
                <span className="text-muted-foreground">Discount <span className="font-medium text-foreground">−{form.currency} {(Number(form.discount_total)||0).toLocaleString()}</span></span>
              )}
              <span className="ml-auto text-sm font-bold">Total {form.currency} {(calcSubtotal(lineItems) + (freightPolicy.allowFreight ? (Number(form.freight_total)||0) : 0) + (Number(form.insurance_total)||0) + (Number(form.other_charges)||0) - (Number(form.discount_total)||0)).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">No VAT — totals are tax-free.</p>
          </div>
        </section>

        {/* 4. Shipping — collapsed */}
        <details className="shrink-0 rounded-md border border-border/60" open={freightPolicy.requireFreight || undefined}>
          <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Shipping &amp; freight{freightPolicy.requireFreight ? ' · required' : ''}
          </summary>
          <div className="space-y-2 border-t border-border/60 p-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-0.5">
                <Label>FOB term</Label>
                <Select value={form.incoterms} onValueChange={(v) => applyShippingPatch({ incoterms: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incotermSelectOptions(form.incoterms).map((x) => (
                      <SelectItem key={x} value={x}>{x}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label>Shipment mode</Label>
                <Select
                  value={form.container_mode === 'RORO Vessel' ? 'RORO' : form.container_mode}
                  onValueChange={(v) =>
                    applyShippingPatch({
                      container_mode: v,
                      shipment_type: v.includes('Container') ? 'Container' : v === 'RORO' ? 'RORO' : form.shipment_type,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RORO">RORO</SelectItem>
                    <SelectItem value="20ft Container">Container 20ft</SelectItem>
                    <SelectItem value="40ft Container">Container 40ft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label>Port of loading</Label>
                <Input className="h-9 text-sm" value={form.port_of_loading} onChange={(e) => setForm({ ...form, port_of_loading: e.target.value })} />
              </div>
              <div className="space-y-0.5">
                <Label>Port of discharge</Label>
                <Input className="h-9 text-sm" value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} placeholder="Destination port" />
              </div>
              <div className="space-y-0.5">
                <Label>Vessel</Label>
                <Input
                  className="h-9 text-sm"
                  value={form.vessel_name}
                  onChange={(e) => setForm({ ...form, vessel_name: e.target.value })}
                  list="invoice-vessel-names"
                  placeholder="Optional"
                />
                <datalist id="invoice-vessel-names">
                  {vesselOptions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-0.5">
                <Label>B/L number</Label>
                <Input className="h-9 text-sm" value={form.bl_number} onChange={(e) => setForm({ ...form, bl_number: e.target.value })} />
              </div>
              {freightPolicy.allowFreight ? (
                <>
                  <div className="space-y-0.5 sm:col-span-2">
                    <Label>Freight description{freightPolicy.requireFreight ? ' *' : ''}</Label>
                    <Input
                      className="h-9 text-sm"
                      value={form.freight_notes}
                      onChange={(e) => setForm({ ...form, freight_notes: e.target.value })}
                      placeholder={freightPolicy.defaultFreightLabel}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label>Freight ({form.currency}){freightPolicy.requireFreight ? ' *' : ''}</Label>
                    <Input
                      className="h-9 text-sm"
                      type="number"
                      value={form.freight_total}
                      onChange={(e) => setForm({ ...form, freight_total: e.target.value })}
                      placeholder="0"
                      required={freightPolicy.requireFreight}
                    />
                  </div>
                </>
              ) : (
                <p className="sm:col-span-3 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                  FOB — vehicle cost only; freight not on this invoice.
                </p>
              )}
            </div>
            {freightPolicy.requireFreight && (
              <p className="text-xs leading-tight text-amber-700">Container shipments must include freight.</p>
            )}
          </div>
        </details>

        {/* 5. Optional extras — collapsed; still no VAT */}
        <details className="shrink-0 rounded-md border border-border/60">
          <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            More options
            {(form.due_date || form.sales_agent.trim() || Number(form.insurance_total) || Number(form.other_charges) || Number(form.discount_total) || form.notes.trim()) ? ' · set' : ''}
          </summary>
          <div className="space-y-2 border-t border-border/60 p-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-0.5">
                <Label>Due date</Label>
                <Input className="h-9 text-sm" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-0.5">
                <Label>Sales agent</Label>
                <Input className="h-9 text-sm" value={form.sales_agent} onChange={(e) => setForm({ ...form, sales_agent: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-0.5">
                <Label>Payment status</Label>
                <Select value={form.payment_status} onValueChange={(v: Invoice['payment_status']) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="credited">Credited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label>Insurance</Label>
                <Input className="h-9 text-sm" type="number" value={form.insurance_total} onChange={(e) => setForm({ ...form, insurance_total: e.target.value })} />
              </div>
              <div className="space-y-0.5">
                <Label>Other charges</Label>
                <Input className="h-9 text-sm" type="number" value={form.other_charges} onChange={(e) => setForm({ ...form, other_charges: e.target.value })} />
              </div>
              <div className="space-y-0.5">
                <Label>Invoice discount</Label>
                <Input className="h-9 text-sm" type="number" value={form.discount_total} onChange={(e) => setForm({ ...form, discount_total: e.target.value })} />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional invoice notes" className="min-h-[2.5rem] text-sm" />
            </div>
          </div>
        </details>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" className="h-8" disabled={submitting || !canSaveInvoice}>
            {submitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving...</> : title.includes('Edit') ? 'Save changes' : 'Create invoice'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent></Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={isAuction ? 'Auction deposit invoices' : 'Invoices'} description={isAuction ? 'Auction deposit invoices with a manual deposit amount — same print layout as commercial invoices' : 'Proforma, commercial, and purchase invoices with PDF generation'} actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export</Button>{canCreateInvoice && <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />{isAuction ? 'New auction invoice' : 'New invoice'}</Button>}</div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total invoices', value: stats.total }, { label: 'Unpaid', value: stats.unpaid }, { label: 'Paid', value: stats.paid }, { label: 'Outstanding', value: stats.outstanding.toLocaleString() },
      ].map((s) => <Card key={s.label} className="erp-stat-card"><CardContent className="p-4"><p className="erp-stat-label">{s.label}</p><p className="erp-stat-value text-xl">{s.value}</p></CardContent></Card>)}</div>
      <div className="erp-filter-panel">
        <div className="erp-filter-bar">
          <div className="erp-filter-search">
            <Search aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice code..." />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="erp-filter-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="credited">Credited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={cn('grid gap-4', receivablesByCurrency.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_17rem]')}>
        <div className="erp-list-panel">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading invoices...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold">No invoices found</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSellingFocused
                  ? 'You only see invoices you created or that belong to your customers.'
                  : 'Create an invoice or adjust your filters.'}
              </p>
            </div>
          ) : (
            <div className="erp-table-scroll">
              <table className="erp-data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="erp-chip-inv" aria-hidden>
                            INV
                          </span>
                          <span className="font-medium text-foreground">{inv.invoice_code}</span>
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate text-muted-foreground">
                        {customerName(inv.customer_id)}
                      </td>
                      <td>
                        <span className={typeChipClass[inv.invoice_type]}>{typeLabels[inv.invoice_type]}</span>
                      </td>
                      <td>
                        <span className={cn(statusChipClass[inv.payment_status], 'capitalize')}>
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {inv.currency} {inv.total.toLocaleString()}
                      </td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 px-2.5"
                              aria-label={`Actions for ${inv.invoice_code}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {canEditInvoice && (
                              <DropdownMenuItem onSelect={() => void openEditForInvoice(inv)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteInvoice && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => openDeleteForInvoice(inv)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                            {(canEditInvoice || canDeleteInvoice) && <DropdownMenuSeparator />}
                            <DropdownMenuItem onSelect={() => void openPrintPreview(inv)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {receivablesByCurrency.length > 0 ? (
          <aside className="erp-summary-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total receivables
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {receivablesByCurrency.length === 1
                ? formatCurrency(receivablesByCurrency[0].total, receivablesByCurrency[0].currency)
                : `${receivablesByCurrency.length} currencies`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.unpaid + kindInvoices.filter((i) => i.payment_status === 'partial').length} unpaid / partial
            </p>
            <ul className="mt-4 space-y-2.5 border-t border-border/50 pt-3">
              {receivablesByCurrency.map((bucket) => (
                <li key={bucket.currency} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                      {bucket.currency.slice(0, 2)}
                    </span>
                    {bucket.currency}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {formatCurrency(bucket.total, bucket.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
      {lineItemForm(createOpen, () => setCreateOpen(false), submitCreate, isAuction ? 'New auction deposit invoice' : 'New invoice')}
      {lineItemForm(editOpen, () => setEditOpen(false), submitEdit, isAuction ? 'Edit auction deposit invoice' : 'Edit invoice')}
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete invoice?" description="This will permanently remove the invoice and its line items." onConfirm={confirmDelete} loading={submitting} />
      <DocumentPrintPreview
        open={printOpen}
        onOpenChange={closePrintPreview}
        title={isAuction ? 'Auction deposit invoice preview' : 'Commercial Invoice Preview'}
        toolbar={
          <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <Switch checked={printShowQr} onCheckedChange={setPrintShowQr} />
                QR code {printShowQr ? 'on' : 'off'}
              </label>
              <p className="text-xs text-muted-foreground">
                Pinch or scroll to pan. Print uses A4 — turn off browser Headers and footers if a URL appears.
              </p>
            </div>
            {selected?.verification_token ? (
              <p className="break-all text-xs text-muted-foreground">
                Verify link:{' '}
                <a
                  href={buildVerifyUrl(selected.verification_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {buildVerifyUrl(selected.verification_token)}
                </a>
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No verification token on this invoice — QR / link unavailable.
              </p>
            )}
          </div>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => closePrintPreview(false)}>Close</Button>
            {selected?.verification_token && (
              <>
                <Button variant="outline" onClick={openVerifyLink}>
                  <ExternalLink className="h-4 w-4 mr-2" /> Open Link
                </Button>
                <Button variant="outline" onClick={copyVerifyLink}>
                  <QrCode className="h-4 w-4 mr-2" /> Copy Verify Link
                </Button>
              </>
            )}
            <Button variant="outline" onClick={exportCommercialExcel}>
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={async () => {
              if (!selected) return;
              await exportCommercialInvoiceDocx({
                invoice: selected,
                items,
                customer: customers.find((c) => c.id === selected.customer_id) || null,
                vehicles,
              });
              toast.success('Word invoice downloaded');
            }}>
              <Download className="h-4 w-4 mr-2" /> Word
            </Button>
            <Button onClick={() => void printDocumentPdf(selected?.invoice_code || 'Invoice')}>
              <Printer className="h-4 w-4 mr-2" /> Print / PDF
            </Button>
          </>
        }
      >
        {selected ? (
          <CommercialInvoiceTemplate
            invoice={selected}
            items={items}
            customer={customers.find((c) => c.id === selected.customer_id) || null}
            company={
              companySettings
                ? {
                    company_name: companySettings.company_name,
                    legal_name: companySettings.legal_name,
                    logo_url: companySettings.logo_url,
                    hanko_url: companySettings.hanko_url,
                  }
                : null
            }
            vehicles={vehicles}
            salesAgent={selected.sales_agent_name || form.sales_agent || null}
            showQr={printShowQr}
            variant={isAuction ? 'auction_deposit' : 'commercial'}
          />
        ) : null}
      </DocumentPrintPreview>
    </div>
  );
}
