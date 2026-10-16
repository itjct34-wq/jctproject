'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { exportToExcel } from '@/lib/utils/excel-export';
import { exportCommercialInvoiceExcel } from '@/lib/utils/commercial-invoice-excel';
import { exportCommercialInvoiceDocx } from '@/lib/utils/commercial-invoice-docx';
import { CommercialInvoiceTemplate } from '@/components/invoices/commercial-invoice-template';
import { buildVerifyUrl } from '@/components/invoices/qr-code';
import { printDocumentPdf } from '@/lib/utils/print-document-pdf';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Switch } from '@/components/ui/switch';
import type { Invoice, InvoiceItem, Customer, Sale, Vehicle, CompanySettings } from '@/lib/types';
import { ChevronRight, Download, FileText, Loader2, Pencil, Plus, Search, Trash2, Printer, QrCode } from 'lucide-react';
import { CurrencySelect } from '@/components/ui/currency-select';
import { DEPOSIT_RATIOS, decodeInvoiceVehicle, describeInvoiceVehicle, formatTransmissionLabel, normalizeDepositRatio } from '@/lib/jct-official';
import { customerContactErrorMessage, isCustomerConsigneeComplete } from '@/lib/utils/customer-contact';
import {
  freightValidationError,
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';
import { toast } from 'sonner';

export type InvoiceWorkspaceKind = 'commercial' | 'auction';

const AUCTION_DEPOSIT_TERMS = 'AUCTION DEPOSIT';

export function isAuctionDepositInvoice(inv: Pick<Invoice, 'payment_terms' | 'invoice_code'>) {
  return (
    (inv.payment_terms || '').toUpperCase().startsWith(AUCTION_DEPOSIT_TERMS) ||
    /AD\d/i.test(inv.invoice_code || '')
  );
}

const statusStyles: Record<Invoice['payment_status'], string> = {
  unpaid: 'bg-red-50 text-red-700 border-red-200', partial: 'bg-amber-50 text-amber-700 border-amber-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-slate-100 text-slate-600 border-slate-200', credited: 'bg-blue-50 text-blue-700 border-blue-200',
};
const typeLabels: Record<Invoice['invoice_type'], string> = { proforma: 'Proforma', commercial: 'Commercial', credit_note: 'Credit Note' };
const emptyForm = {
  customer_mode: 'existing' as 'existing' | 'manual',
  customer_id: '', sale_id: '', invoice_type: 'commercial' as Invoice['invoice_type'],
  invoice_code_mode: 'auto' as 'auto' | 'manual', invoice_code: '',
  issue_date: '', due_date: '', tax: '', currency: 'USD', notes: '',
  incoterms: 'FOB', shipment_type: 'RORO', container_mode: 'RORO Vessel',
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineDraft[]>([]);
  const isAuction = kind === 'auction';
  const [companySettings, setCompanySettings] = useState<Pick<
    CompanySettings,
    'id' | 'invoice_prefix' | 'invoice_next_number' | 'company_name' | 'legal_name' | 'logo_url' | 'hanko_url'
  > | null>(null);
  const [printShowQr, setPrintShowQr] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes, sRes, vRes, setRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(250),
      supabase.from('customers').select('id, full_name, customer_code, company_name, email, phone, whatsapp, country, city, address_line1, address_line2').order('full_name').limit(250),
      supabase.from('sales').select('id, sale_code').order('created_at', { ascending: false }).limit(250),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number, color, listed_price, model_year, transmission').order('created_at', { ascending: false }).limit(250),
      supabase
        .from('company_settings')
        .select('id, invoice_prefix, invoice_next_number, company_name, legal_name, logo_url, hanko_url')
        .limit(1)
        .maybeSingle(),
    ]);
    if (iRes.error) toast.error(`Unable to load invoices: ${iRes.error.message}`);
    else setInvoices((iRes.data || []) as Invoice[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (sRes.data) setSales(sRes.data as Sale[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
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
  const saleCode = (id: string | null) => id ? sales.find((s) => s.id === id)?.sale_code || '' : '';

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
      unit_price: next[idx].unit_price || String(v.listed_price || ''),
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

  const loadDetails = async (inv: Invoice) => {
    setSelected(inv);
    setDetailSheetOpen(true);
    setDetailLoading(true);
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order', { ascending: true });
    if (error) toast.error(`Could not load line items: ${error.message}`);
    setItems((data || []) as InvoiceItem[]); setDetailLoading(false);
  };

  /** Load line items and open the commercial invoice print/PDF preview without opening the edit sheet. */
  const openPrintPreview = async (inv: Invoice) => {
    setSelected(inv);
    setDetailLoading(true);
    setPrintOpen(true);
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order', { ascending: true });
    if (error) toast.error(`Could not load line items: ${error.message}`);
    setItems((data || []) as InvoiceItem[]);
    setDetailLoading(false);
  };

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
  const openEdit = () => {
    if (!selected) return;
    const editPolicy = resolveFreightPolicy({
      incoterm: selected.incoterms || 'FOB',
      shipmentType: selected.shipment_type || 'RORO',
      containerMode: selected.container_mode || 'RORO Vessel',
    });
    setForm({
      customer_mode: 'existing',
      guest_name: '', guest_company: '', guest_email: '', guest_phone: '',
      guest_country: '', guest_city: '', guest_address: '',
      customer_id: selected.customer_id, sale_id: selected.sale_id || '', invoice_type: selected.invoice_type,
      invoice_code_mode: 'manual', invoice_code: selected.invoice_code,
      issue_date: selected.issue_date, due_date: selected.due_date || '', tax: String(selected.tax),
      currency: selected.currency, notes: selected.notes || '',
      incoterms: selected.incoterms || 'FOB', shipment_type: selected.shipment_type || 'RORO',
      container_mode: selected.container_mode || 'RORO Vessel',
      port_of_loading: selected.port_of_loading || 'Nagoya, Japan',
      port_of_discharge: selected.port_of_discharge || '', vessel_name: selected.vessel_name || '',
      bl_number: selected.bl_number || '',
      freight_total: String(normalizeFreightAmount(editPolicy, selected.freight_total)),
      freight_notes: normalizeFreightNotes(editPolicy, selected.freight_notes) || '',
      insurance_total: String(selected.insurance_total ?? 0),
      other_charges: String(selected.other_charges ?? 0), discount_total: String(selected.discount_total ?? 0),
      payment_terms: selected.payment_terms || defaultPaymentTerms(kind),
      bank_details: selected.bank_details || '',
      sales_agent: selected.sales_agent_name || '',
      payment_status: selected.payment_status,
    });
    setLineItems(items.map((i) => {
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
    if (items.length === 0) setLineItems([{ ...emptyLine(kind) }]);
    setEditOpen(true);
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
    const missing = isCustomerConsigneeComplete({ full_name: name, email, phone, address_line1: address });
    if (missing) {
      toast.error(missing);
      return null;
    }
    const payload = {
      full_name: name,
      company_name: form.guest_company.trim() || null,
      email,
      phone,
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
    const { data, error } = await supabase.from('invoices').insert({ invoice_code: invoiceCode, customer_id: customerId, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date || new Date().toISOString().split('T')[0], due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, payment_status: form.payment_status, notes: form.notes.trim() || null, incoterms: form.incoterms || 'FOB', shipment_type: form.shipment_type || 'RORO', container_mode: form.container_mode || (form.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel'), port_of_loading: form.port_of_loading || 'Nagoya, Japan', port_of_discharge: form.port_of_discharge || null, vessel_name: form.vessel_name || null, bl_number: form.bl_number || null, freight_total: freight, freight_notes: freightNotes, insurance_total: insurance, other_charges: other, discount_total: discount, payment_terms: paymentTerms, bank_details: form.bank_details || null, sales_agent_name: form.sales_agent.trim() || null, created_by: profile.id }).select().maybeSingle();
    if (error) { setSubmitting(false); toast.error(`Could not create invoice: ${error.message}`); return; }
    const inv = data as Invoice;
    const itemRows = linePayload(inv.id);
    if (itemRows.length > 0) {
      const { error: itemError } = await supabase.from('invoice_items').insert(itemRows);
      if (itemError) toast.error(`Invoice created but line items failed: ${itemError.message}`);
    }
    if (form.invoice_code_mode === 'auto') await bumpInvoiceNumber();
    setSubmitting(false); toast.success(isAuction ? 'Auction deposit invoice created' : 'Invoice created'); setForm({ ...emptyForm, payment_terms: defaultPaymentTerms(kind) }); setLineItems([{ ...emptyLine(kind) }]); setCreateOpen(false); loadData(); await loadDetails(inv);
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
    const { error } = await supabase.from('invoices').update({ invoice_code: form.invoice_code.trim() || selected.invoice_code, customer_id: customerId, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date, due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, notes: form.notes.trim() || null, incoterms: form.incoterms || 'FOB', shipment_type: form.shipment_type || 'RORO', container_mode: form.container_mode || (form.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel'), port_of_loading: form.port_of_loading || 'Nagoya, Japan', port_of_discharge: form.port_of_discharge || null, vessel_name: form.vessel_name || null, bl_number: form.bl_number || null, freight_total: freight, freight_notes: freightNotes, insurance_total: insurance, other_charges: other, discount_total: discount, payment_terms: paymentTerms, bank_details: form.bank_details || null, sales_agent_name: form.sales_agent.trim() || null, payment_status: form.payment_status, updated_at: new Date().toISOString() }).eq('id', selected.id);
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
    setSelected(updated); setInvoices((items) => items.map((i) => i.id === updated.id ? updated : i));
    await loadDetails(updated); toast.success('Invoice updated'); setEditOpen(false);
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
    toast.success('Invoice deleted'); setDeleteOpen(false); setDetailSheetOpen(false); setSelected(null); loadData();
  };

  const updatePaymentStatus = async (payment_status: Invoice['payment_status']) => {
    if (!selected) return;
    const { error } = await supabase.from('invoices').update({ payment_status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, payment_status }; setSelected(updated);
    setInvoices((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Payment status updated');
  };

  const isDraft = selected && selected.payment_status === 'unpaid';
  const hasPayments = selected && (selected.payment_status === 'paid' || selected.payment_status === 'partial');

  const handleExport = async () => {
    const rows = filtered.map((i) => ({ code: i.invoice_code, customer: customerName(i.customer_id), type: typeLabels[i.invoice_type], issue: format(new Date(i.issue_date), 'yyyy-MM-dd'), due: i.due_date ? format(new Date(i.due_date), 'yyyy-MM-dd') : '', subtotal: i.subtotal, total: i.total, currency: i.currency, status: i.payment_status }));
    await exportToExcel('invoices-export', 'Invoices', [
      { header: 'Invoice #', key: 'code', width: 18 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Type', key: 'type', width: 14 }, { header: 'Issue Date', key: 'issue', width: 14 }, { header: 'Due Date', key: 'due', width: 14 }, { header: 'Subtotal', key: 'subtotal', width: 14, format: '#,##0' }, { header: 'Total', key: 'total', width: 14, format: '#,##0' }, { header: 'Currency', key: 'currency', width: 10 }, { header: 'Status', key: 'status', width: 12 },
    ], rows, { title: 'Invoice Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length) } });
    toast.success('Invoices exported');
  };

  const printInvoice = () => { setPrintOpen(true); };

  const closePrintPreview = (open: boolean) => {
    setPrintOpen(open);
    if (!open && !detailSheetOpen) {
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

  const kindInvoices = invoices.filter((inv) => (isAuction ? isAuctionDepositInvoice(inv) : !isAuctionDepositInvoice(inv)));
  const stats = { total: kindInvoices.length, unpaid: kindInvoices.filter((i) => i.payment_status === 'unpaid').length, paid: kindInvoices.filter((i) => i.payment_status === 'paid').length, outstanding: kindInvoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + i.total, 0) };

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
      ? !isCustomerConsigneeComplete({
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
    <Dialog open={isOpen} onOpenChange={onClose}><DialogContent fullscreen><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><form onSubmit={onSubmit} className="space-y-2.5">
        {/* Customer + invoice meta */}
        <section className="space-y-1.5 rounded-md border border-border/60 p-2">
          <div className="grid gap-1.5 sm:grid-cols-3">
            <div className="space-y-0.5">
              <Label>Customer source</Label>
              <Select
                value={form.customer_mode}
                onValueChange={(v: 'existing' | 'manual') => setForm({ ...form, customer_mode: v, customer_id: v === 'manual' ? '' : form.customer_id })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">From database</SelectItem>
                  <SelectItem value="manual">Enter details</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label>Sale (optional)</Label>
              <Select value={form.sale_id} onValueChange={(v) => setForm({ ...form, sale_id: v })}>
                <SelectTrigger><SelectValue placeholder="Link to sale" /></SelectTrigger>
                <SelectContent>{sales.map((s) => <SelectItem key={s.id} value={s.id}>{s.sale_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.customer_mode === 'existing' ? (
              <div className="space-y-0.5">
                <Label>Customer *</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => {
                    const c = customers.find((x) => x.id === v);
                    setForm({
                      ...form,
                      customer_id: v,
                      guest_name: c?.full_name || '',
                      guest_company: c?.company_name || '',
                      guest_email: c?.email || '',
                      guest_phone: c?.phone || '',
                      guest_country: c?.country || '',
                      guest_city: c?.city || '',
                      guest_address: c?.address_line1 || '',
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.customer_code ? ` · ${c.customer_code}` : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-0.5">
                <Label>Consignee Name *</Label>
                <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder="Consignee name" required />
              </div>
            )}
          </div>
          {form.customer_mode === 'existing' && selectedCustomer && (
            <p className="truncate text-[11px] text-muted-foreground">
              {selectedCustomer.full_name}
              {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
              {selectedCustomer.email ? ` · ${selectedCustomer.email}` : ''}
              {' · '}
              {[selectedCustomer.address_line1, selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(', ') || 'No address'}
            </p>
          )}
          {form.customer_mode === 'manual' && (
            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="space-y-0.5"><Label>Company</Label><Input value={form.guest_company} onChange={(e) => setForm({ ...form, guest_company: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-0.5"><Label>Contact *</Label><Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} placeholder="Phone" required /></div>
              <div className="space-y-0.5"><Label>Email *</Label><Input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} placeholder="Email" required /></div>
              <div className="space-y-0.5"><Label>Country</Label><Input value={form.guest_country} onChange={(e) => setForm({ ...form, guest_country: e.target.value })} /></div>
              <div className="space-y-0.5"><Label>City</Label><Input value={form.guest_city} onChange={(e) => setForm({ ...form, guest_city: e.target.value })} /></div>
              <div className="space-y-0.5"><Label>Address *</Label><Input value={form.guest_address} onChange={(e) => setForm({ ...form, guest_address: e.target.value })} placeholder="Shipping address" required /></div>
            </div>
          )}
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-0.5">
              <Label>Invoice #</Label>
              <Select
                value={form.invoice_code_mode}
                onValueChange={(v: 'auto' | 'manual') =>
                  setForm({
                    ...form,
                    invoice_code_mode: v,
                    invoice_code: v === 'auto' ? nextAutoInvoiceCode() : form.invoice_code,
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <Label>{form.invoice_code_mode === 'auto' ? 'Next number' : 'Number'}</Label>
              <Input
                value={form.invoice_code}
                onChange={(e) => setForm({ ...form, invoice_code: e.target.value, invoice_code_mode: 'manual' })}
                placeholder="JCT0003"
              />
            </div>
            <div className="space-y-0.5"><Label>Type</Label><Select value={form.invoice_type} onValueChange={(v: Invoice['invoice_type']) => setForm({ ...form, invoice_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="proforma">Proforma</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="credit_note">Credit Note</SelectItem></SelectContent></Select></div>
            <div className="space-y-0.5"><Label>Currency</Label><CurrencySelect value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} /></div>
            <div className="space-y-0.5"><Label>Payment</Label><Select value={form.payment_status} onValueChange={(v: Invoice['payment_status']) => setForm({ ...form, payment_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div>
            <div className="space-y-0.5"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-4"><Label>Sales agent</Label><Input value={form.sales_agent} onChange={(e) => setForm({ ...form, sales_agent: e.target.value })} placeholder="Sales agent name" /></div>
          </div>
        </section>

        {/* Vehicles */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Vehicles</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => setLineItems([...lineItems, { ...emptyLine(kind) }])}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
          </div>
          <div className="space-y-1.5">
            {lineItems.map((item, idx) => (
              <div key={idx} className="space-y-1 rounded-md border border-border/60 p-1.5">
                <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="space-y-0.5 sm:col-span-2 lg:col-span-2">
                    <Label>From stock</Label>
                    <Select value={item.vehicle_id || 'none'} onValueChange={(v) => applyVehicle(idx, v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Enter manually</SelectItem>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.stock_number} · {v.make} {v.model} · {v.chassis_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5"><Label>Chassis</Label><Input value={item.chassis_number} onChange={(e) => updateLine(idx, { chassis_number: e.target.value, vehicle_id: '' })} placeholder="Chassis" /></div>
                  <div className="space-y-0.5"><Label>Stock no.</Label><Input value={item.stock_number} onChange={(e) => updateLine(idx, { stock_number: e.target.value, vehicle_id: '' })} placeholder="Stock" /></div>
                  <div className="space-y-0.5"><Label>Make</Label><Input value={item.make} onChange={(e) => updateLine(idx, { make: e.target.value, vehicle_id: '' })} placeholder="Make" /></div>
                  <div className="space-y-0.5"><Label>Model</Label><Input value={item.model} onChange={(e) => updateLine(idx, { model: e.target.value, vehicle_id: '' })} placeholder="Model" /></div>
                  <div className="space-y-0.5"><Label>Colour</Label><Input value={item.colour} onChange={(e) => updateLine(idx, { colour: e.target.value, vehicle_id: '' })} placeholder="Colour" /></div>
                  <div className="space-y-0.5"><Label>Year</Label><Input value={item.year} onChange={(e) => updateLine(idx, { year: e.target.value, vehicle_id: '' })} placeholder="2016" /></div>
                  <div className="space-y-0.5"><Label>Engine</Label><Input value={item.engine} onChange={(e) => updateLine(idx, { engine: e.target.value, vehicle_id: '' })} placeholder="1500cc" /></div>
                  <div className="space-y-0.5"><Label>Transmission</Label><Input value={item.transmission} onChange={(e) => updateLine(idx, { transmission: e.target.value, vehicle_id: '' })} placeholder="AT" /></div>
                  <div className="space-y-0.5 sm:col-span-2"><Label>Notes</Label><Input value={item.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="Optional description" /></div>
                  <div className="space-y-0.5"><Label>Qty</Label><Input type="number" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} /></div>
                  <div className="space-y-0.5"><Label>Cost</Label><Input type="number" value={item.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} /></div>
                  <div className="space-y-0.5">
                    <Label>{isAuction ? 'Deposit amt' : 'Deposit %'}</Label>
                    {isAuction ? (
                      <Input type="number" value={item.discount} onChange={(e) => updateLine(idx, { discount: e.target.value })} placeholder="Amount" />
                    ) : (
                      <Select value={item.discount || '30'} onValueChange={(v) => updateLine(idx, { discount: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEPOSIT_RATIOS.map((ratio) => (
                            <SelectItem key={ratio} value={String(ratio)}>{ratio}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex items-end justify-end">
                    <Button type="button" size="icon" variant="ghost" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} aria-label="Remove vehicle">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Freight + totals — FOB = vehicle cost only; Container non-FOB requires freight */}
        {freightPolicy.allowFreight ? (
          <div className="grid gap-1.5 sm:grid-cols-3">
            <div className="space-y-0.5 sm:col-span-2">
              <Label>Freight description{freightPolicy.requireFreight ? ' *' : ''}</Label>
              <Input
                value={form.freight_notes}
                onChange={(e) => setForm({ ...form, freight_notes: e.target.value })}
                placeholder={freightPolicy.defaultFreightLabel}
              />
            </div>
            <div className="space-y-0.5">
              <Label>Freight ({form.currency}){freightPolicy.requireFreight ? ' *' : ''}</Label>
              <Input
                type="number"
                value={form.freight_total}
                onChange={(e) => setForm({ ...form, freight_total: e.target.value })}
                placeholder="0"
                required={freightPolicy.requireFreight}
              />
              {freightPolicy.requireFreight && (
                <p className="text-[10px] text-amber-700">Container shipments must include freight.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            FOB — vehicle cost only; freight is not included on this invoice.
          </p>
        )}
        <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs space-y-0.5">
          <div className="flex justify-between"><span className="text-muted-foreground">Vehicles</span><span>{form.currency} {calcSubtotal(lineItems).toLocaleString()}</span></div>
          {isAuction && (
            <div className="flex justify-between"><span className="text-muted-foreground">Deposit due</span><span>{form.currency} {lineItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0).toLocaleString()}</span></div>
          )}
          {freightPolicy.allowFreight && (
            <div className="flex justify-between"><span className="text-muted-foreground">{freightPolicy.isRoro ? 'Ocean freight' : 'Freight'}</span><span>{form.currency} {(Number(form.freight_total)||0).toLocaleString()}</span></div>
          )}
          {((Number(form.insurance_total)||0)+(Number(form.other_charges)||0)) > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance / Other</span><span>{form.currency} {((Number(form.insurance_total)||0)+(Number(form.other_charges)||0)).toLocaleString()}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-sm font-bold"><span>Invoice total</span><span>{form.currency} {(calcSubtotal(lineItems) + (freightPolicy.allowFreight ? (Number(form.freight_total)||0) : 0) + (Number(form.insurance_total)||0) + (Number(form.other_charges)||0) - (Number(form.discount_total)||0)).toLocaleString()}</span></div>
        </div>

        {/* Shipping / bank — collapsed by default */}
        <details className="rounded-md border border-border/60 open:pb-1.5">
          <summary className="cursor-pointer select-none px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">Shipping terms, charges & bank</summary>
          <div className="grid gap-1.5 border-t border-border/60 px-2.5 pt-1.5 sm:grid-cols-3">
            <div className="space-y-0.5"><Label>Incoterms</Label>
              <Select value={form.incoterms} onValueChange={(v) => applyShippingPatch({ incoterms: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['FOB','C&F','CFR','CIF','EXW','FCA','CPT','CIP','DAP','DDP'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5"><Label>Shipment type</Label>
              <Select value={form.shipment_type} onValueChange={(v) => applyShippingPatch({
                shipment_type: v,
                container_mode: v === 'RORO' ? 'RORO Vessel' : v === 'Container' ? '40ft Container' : form.container_mode,
              })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RORO">RORO</SelectItem>
                  <SelectItem value="Container">Container</SelectItem>
                  <SelectItem value="Air Freight">Air Freight</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5"><Label>RORO / Container</Label>
              <Select value={form.container_mode} onValueChange={(v) => applyShippingPatch({ container_mode: v, shipment_type: v.includes('Container') ? 'Container' : v.includes('RORO') ? 'RORO' : form.shipment_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RORO Vessel">RORO Vessel</SelectItem>
                  <SelectItem value="20ft Container">20ft Container</SelectItem>
                  <SelectItem value="40ft Container">40ft Container</SelectItem>
                  <SelectItem value="40ft HC">40ft HC Container</SelectItem>
                  <SelectItem value="LCL">LCL Container</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5"><Label>Port of loading</Label><Input value={form.port_of_loading} onChange={(e) => setForm({ ...form, port_of_loading: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Port of discharge</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Vessel</Label><Input value={form.vessel_name} onChange={(e) => setForm({ ...form, vessel_name: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>BL number</Label><Input value={form.bl_number} onChange={(e) => setForm({ ...form, bl_number: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Insurance</Label><Input type="number" value={form.insurance_total} onChange={(e) => setForm({ ...form, insurance_total: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Other charges</Label><Input type="number" value={form.other_charges} onChange={(e) => setForm({ ...form, other_charges: e.target.value })} /></div>
            <div className="space-y-0.5"><Label>Discount</Label><Input type="number" value={form.discount_total} onChange={(e) => setForm({ ...form, discount_total: e.target.value })} /></div>
            <div className="space-y-0.5 sm:col-span-2"><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
            <div className="space-y-0.5 sm:col-span-3"><Label>Bank details</Label><Textarea value={form.bank_details} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} rows={2} placeholder="Bank, account, SWIFT..." /></div>
            <div className="space-y-0.5 sm:col-span-3"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
        </details>

        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting || !canSaveInvoice}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : title.includes('Edit') ? 'Save changes' : 'Create invoice'}</Button></DialogFooter></form></DialogContent></Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={isAuction ? 'Auction deposit invoices' : 'Invoices'} description={isAuction ? 'Auction deposit invoices with a manual deposit amount — same print layout as commercial invoices' : 'Proforma, commercial, and purchase invoices with PDF generation'} actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export</Button>{canCreateInvoice && <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />{isAuction ? 'New auction invoice' : 'New invoice'}</Button>}</div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total invoices', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Unpaid', value: stats.unpaid, tone: 'bg-red-50 text-red-600' }, { label: 'Paid', value: stats.paid, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Outstanding', value: stats.outstanding.toLocaleString(), tone: 'bg-amber-50 text-amber-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice code..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading invoices...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-10 text-center"><FileText className="mb-2 h-8 w-8 text-muted-foreground/50" /><h3 className="text-sm font-semibold">No invoices found</h3><p className="mt-1 text-xs text-muted-foreground">{isSellingFocused ? 'You only see invoices you created or that belong to your customers.' : 'Create an invoice or adjust your filters.'}</p></div> : <div className="divide-y divide-border/70">{filtered.map((inv) => (
        <div
          key={inv.id}
          role="button"
          tabIndex={0}
          onClick={() => loadDetails(inv)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadDetails(inv); } }}
          className="erp-list-row cursor-pointer"
        >
          <button
            type="button"
            title="Print / PDF"
            aria-label={`Print or download PDF for ${inv.invoice_code}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            onClick={(e) => {
              e.stopPropagation();
              void openPrintPreview(inv);
            }}
          >
            <FileText className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium">{inv.invoice_code}</p>
              <Badge variant="outline" className={`text-[10px] ${statusStyles[inv.payment_status]}`}>{inv.payment_status}</Badge>
              <Badge variant="secondary" className="text-[10px]">{typeLabels[inv.invoice_type]}</Badge>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{customerName(inv.customer_id)} · {inv.currency} {inv.total.toLocaleString()}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>
      ))}</div>}</Card>
      {lineItemForm(createOpen, () => setCreateOpen(false), submitCreate, isAuction ? 'New auction deposit invoice' : 'New invoice')}
      {lineItemForm(editOpen, () => setEditOpen(false), submitEdit, isAuction ? 'Edit auction deposit invoice' : 'Edit invoice')}
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete invoice?" description="This will permanently remove the invoice and its line items." onConfirm={confirmDelete} loading={submitting} />
      <Sheet open={detailSheetOpen} onOpenChange={(o) => { setDetailSheetOpen(o); if (!o && !printOpen) setSelected(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>{selected?.invoice_code}</SheetTitle><SheetDescription>{selected && typeLabels[selected.invoice_type]}</SheetDescription></SheetHeader>{selected && (<><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={printInvoice}><Printer className="mr-1.5 h-4 w-4" />Print</Button>{canEditInvoice && <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-4 w-4" />Edit</Button>}{canDeleteInvoice && <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>}</div><div className="mt-6 space-y-4">{detailLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div> : (<><div className="flex flex-wrap gap-2"><Badge variant="outline" className={statusStyles[selected.payment_status]}>{selected.payment_status}</Badge>{['unpaid','partial','paid','cancelled','credited'].map((s) => <Button key={s} size="sm" variant={selected.payment_status === s ? 'default' : 'outline'} onClick={() => updatePaymentStatus(s as Invoice['payment_status'])}>{s}</Button>)}</div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Customer</p><p className="mt-1 font-medium">{customerName(selected.customer_id)}</p></div>{items.length > 0 && <Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.line_total.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>}<div className="space-y-1"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{selected.currency} {selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total</span><span>{selected.currency} {selected.total.toLocaleString()}</span></div></div></>)}</div></>)}</SheetContent></Sheet>
      <Dialog open={printOpen} onOpenChange={closePrintPreview}>
        <DialogContent fullscreen className="print:max-w-none print:shadow-none print:border-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{isAuction ? 'Auction deposit invoice preview' : 'Commercial Invoice Preview'}</DialogTitle>
          </DialogHeader>
          <div className="print:hidden flex flex-wrap items-center gap-4 rounded-md border border-border/60 p-3 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={printShowQr} onCheckedChange={setPrintShowQr} />
              QR code {printShowQr ? 'on' : 'off'}
            </label>
            <p className="text-xs text-muted-foreground">PDF prints one invoice on one A4 page.</p>
          </div>
          {selected && (
            <div className="overflow-x-auto print:overflow-visible">
              <div className="min-w-[720px] print:min-w-0">
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
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden flex-wrap gap-2">
            <Button variant="outline" onClick={() => closePrintPreview(false)}>Close</Button>
            {selected?.verification_token && (
              <Button variant="outline" onClick={copyVerifyLink}>
                <QrCode className="h-4 w-4 mr-2" /> Copy Verify Link
              </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
