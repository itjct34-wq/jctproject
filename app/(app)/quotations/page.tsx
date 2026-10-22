'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentPrintPreview } from '@/components/documents/document-print-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { fetchAllPages } from '@/lib/erp/paged-query';
import type { Quotation, Customer, Vehicle, CompanySettings } from '@/lib/types';
import { CommercialQuotationTemplate } from '@/components/quotations/commercial-quotation-template';
import { buildVerifyUrl } from '@/components/invoices/qr-code';
import { printDocumentPdf } from '@/lib/utils/print-document-pdf';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ChevronRight, Download, ExternalLink, FileText, Loader2, Pencil, Plus, Printer, QrCode, Search, Trash2 } from 'lucide-react';
import { exportQuotationExcel } from '@/lib/utils/commercial-invoice-excel';
import { CurrencySelect } from '@/components/ui/currency-select';
import { toast } from 'sonner';
import {
  decodeInvoiceVehicle,
  encodeInvoiceLineDescription,
  formatTransmissionLabel,
  isJctvEncodedDescription,
  type CompanyLetterheadSettings,
} from '@/lib/jct-official';
import {
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';

function quoteFreightPolicy(priceType: Quotation['price_type']) {
  return resolveFreightPolicy({
    incoterm: priceType === 'CNF' ? 'C&F' : priceType,
    shipmentType: 'RORO',
    containerMode: 'RORO Vessel',
  });
}

const statusStyles: Record<Quotation['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  converted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const emptyForm = {
  customer_id: '',
  price_type: 'FOB' as Quotation['price_type'],
  freight: '0',
  freight_notes: 'Ocean freight',
  insurance: '',
  other_fees: '',
  currency: 'USD',
  valid_until: '',
  notes: '',
  port_of_discharge: '',
};

type LineDraft = {
  description: string;
  quantity: string;
  unit_price: string;
  vehicle_id: string;
  chassis_number: string;
  stock_number: string;
  make: string;
  model: string;
  colour: string;
  year: string;
  engine: string;
  transmission: string;
};

function emptyQuoteLine(): LineDraft {
  return {
    description: '',
    quantity: '1',
    unit_price: '',
    vehicle_id: '',
    chassis_number: '',
    stock_number: '',
    make: '',
    model: '',
    colour: '',
    year: '',
    engine: '',
    transmission: '',
  };
}

function QuotationsPageInner() {
  const { profile } = useAuth();
  const { can, isSellingFocused } = usePermissions();
  const searchParams = useSearchParams();
  const canDeleteQuotation = can('sales', 'delete');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<LineDraft[]>([emptyQuoteLine()]);
  const [printItems, setPrintItems] = useState<
    Array<{ description: string; quantity: number; unit_price: number; line_total: number; vehicle_id?: string | null }>
  >([]);
  const [companyLetterhead, setCompanyLetterhead] = useState<CompanyLetterheadSettings | null>(null);
  const deepLinkHandled = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [qRes, cRes, vRes, setRes] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }).limit(500),
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
            'id, stock_number, make, model, chassis_number, model_year, color, mileage_km, listed_price, listed_currency, status, transmission'
          )
          .in('status', ['in_stock', 'reserved'])
          .order('updated_at', { ascending: false })
          .range(from, to)
      ),
      supabase
        .from('company_settings')
        .select('company_name, legal_name, logo_url, hanko_url')
        .limit(1)
        .maybeSingle(),
    ]);
    if (qRes.error) toast.error(`Unable to load quotations: ${qRes.error.message}`);
    else setQuotations((qRes.data || []) as Quotation[]);
    if (cRes.error) toast.error(`Unable to load customers: ${cRes.error.message}`);
    else setCustomers(cRes.data);
    if (vRes.error) toast.error(`Unable to load vehicles: ${vRes.error.message}`);
    else setVehicles(vRes.data);
    if (setRes.data) {
      const row = setRes.data as Pick<CompanySettings, 'company_name' | 'legal_name' | 'logo_url' | 'hanko_url'>;
      setCompanyLetterhead({
        company_name: row.company_name,
        legal_name: row.legal_name,
        logo_url: row.logo_url,
        hanko_url: row.hanko_url,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((qt) => {
      const matchesStatus = statusFilter === 'all' || qt.status === statusFilter;
      const matchesSearch =
        !q || [qt.quotation_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, search, statusFilter]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';
  const customerOf = (id: string) => customers.find((c) => c.id === id) || null;

  const applyQuoteVehicle = (idx: number, vehicleId: string) => {
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
    if (v.listed_currency) setForm((f) => ({ ...f, currency: v.listed_currency || f.currency }));
  };

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    const next = [...lineItems];
    next[idx] = { ...next[idx], ...patch };
    setLineItems(next);
  };

  const calcSubtotal = (items: LineDraft[]) =>
    items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unit_price) || 0), 0);

  const linePayload = (quotationId: string) =>
    lineItems
      .filter((i) => i.vehicle_id || i.chassis_number.trim() || i.make.trim() || i.stock_number.trim() || i.description.trim())
      .map((item) => ({
        quotation_id: quotationId,
        vehicle_id: item.vehicle_id || null,
        description: encodeInvoiceLineDescription({ ...item, notes: item.description, vehicle_id: item.vehicle_id }),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        line_total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
      }));

  const submitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id) return;
    const policy = quoteFreightPolicy(form.price_type);
    const subtotal = calcSubtotal(lineItems);
    const freight = normalizeFreightAmount(policy, form.freight);
    const freightNotes = normalizeFreightNotes(policy, form.freight_notes);
    const insurance = Number(form.insurance) || 0;
    const otherFees = Number(form.other_fees) || 0;
    const total = subtotal + freight + insurance + otherFees;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('quotations')
      .insert({
        customer_id: form.customer_id,
        price_type: form.price_type,
        subtotal,
        freight,
        freight_notes: freightNotes,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        port_of_discharge: form.port_of_discharge.trim() || null,
        created_by: profile.id,
      })
      .select()
      .maybeSingle();
    if (error) {
      setSubmitting(false);
      toast.error(`Could not create quotation: ${error.message}`);
      return;
    }
    if (data) {
      const rows = linePayload(data.id);
      if (rows.length) await supabase.from('quotation_items').insert(rows);
    }
    setSubmitting(false);
    toast.success('Quotation created');
    setForm(emptyForm);
    setLineItems([emptyQuoteLine()]);
    setCreateOpen(false);
    loadData();
    if (data) setSelected(data as Quotation);
  };

  const openEdit = async () => {
    if (!selected) return;
    const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', selected.id);
    const rows = (data || []) as Array<{
      description?: string;
      vehicle_id?: string | null;
      quantity?: number;
      unit_price?: number;
    }>;
    const editPolicy = quoteFreightPolicy(selected.price_type);
    setForm({
      customer_id: selected.customer_id,
      price_type: selected.price_type,
      freight: String(normalizeFreightAmount(editPolicy, selected.freight)),
      freight_notes: normalizeFreightNotes(editPolicy, selected.freight_notes) || '',
      insurance: String(selected.insurance),
      other_fees: String(selected.other_fees),
      currency: selected.currency,
      valid_until: selected.valid_until || '',
      notes: selected.notes || '',
      port_of_discharge: selected.port_of_discharge || '',
    });
    const mapped = rows.map((item) => {
      const encoded = isJctvEncodedDescription(item.description);
      const bits = decodeInvoiceVehicle(item.description);
      const v = vehicles.find((x) => x.id === item.vehicle_id);
      return {
        description: encoded ? bits.notes || '' : item.description || '',
        quantity: String(item.quantity ?? 1),
        unit_price: String(item.unit_price ?? 0),
        vehicle_id: item.vehicle_id || '',
        chassis_number: (encoded ? bits.chassis_number : '') || v?.chassis_number || '',
        stock_number: (encoded ? bits.stock_number : '') || v?.stock_number || '',
        make: (encoded ? bits.make : '') || v?.make || '',
        model: (encoded ? bits.model : '') || v?.model || '',
        colour: (encoded ? bits.colour : '') || v?.color || '',
        year: (encoded ? bits.year : '') || (v?.model_year != null ? String(v.model_year) : ''),
        engine: (encoded ? bits.engine : '') || '',
        transmission: (encoded ? bits.transmission : '') || formatTransmissionLabel(v?.transmission),
      };
    });
    setLineItems(mapped.length ? mapped : [emptyQuoteLine()]);
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const policy = quoteFreightPolicy(form.price_type);
    const subtotal = calcSubtotal(lineItems);
    const freight = normalizeFreightAmount(policy, form.freight);
    const freightNotes = normalizeFreightNotes(policy, form.freight_notes);
    const insurance = Number(form.insurance) || 0;
    const otherFees = Number(form.other_fees) || 0;
    const total = subtotal + freight + insurance + otherFees;
    setSubmitting(true);
    const { error } = await supabase
      .from('quotations')
      .update({
        customer_id: form.customer_id,
        price_type: form.price_type,
        subtotal,
        freight,
        freight_notes: freightNotes,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        port_of_discharge: form.port_of_discharge.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    if (error) {
      setSubmitting(false);
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    await supabase.from('quotation_items').delete().eq('quotation_id', selected.id);
    const rows = linePayload(selected.id);
    if (rows.length) await supabase.from('quotation_items').insert(rows);
    setSubmitting(false);
    const updated = {
      ...selected,
      customer_id: form.customer_id,
      price_type: form.price_type,
      subtotal,
      freight,
      insurance,
      other_fees: otherFees,
      total,
      currency: form.currency,
      valid_until: form.valid_until || null,
      notes: form.notes.trim() || null,
      freight_notes: freightNotes,
      port_of_discharge: form.port_of_discharge.trim() || null,
    };
    setSelected(updated);
    setQuotations((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Quotation updated');
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('quotations').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    toast.success('Quotation deleted');
    setDeleteOpen(false);
    setSelected(null);
    loadData();
  };

  const updateStatus = async (status: Quotation['status']) => {
    if (!selected) return;
    const { error } = await supabase
      .from('quotations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...selected, status };
    setSelected(updated);
    setQuotations((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Quotation status updated');
  };

  /** Load line items and open the commercial quotation print/PDF preview. */
  const openPrintPreview = async (qt: Quotation) => {
    setSelected(qt);
    const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', qt.id);
    const rows = (data || []) as Array<{
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      vehicle_id?: string | null;
    }>;
    if (rows.length > 0) {
      setPrintItems(rows);
    } else {
      const desc = qt.notes?.split('\n---\n').pop() || `${qt.price_type} quotation`;
      setPrintItems([
        {
          description: desc,
          quantity: 1,
          unit_price: qt.subtotal,
          line_total: qt.subtotal,
          vehicle_id: null,
        },
      ]);
    }
    setPrintOpen(true);
  };

  const openPrint = async () => {
    if (!selected) return;
    await openPrintPreview(selected);
  };

  // QT chip / "Open quotation" links use ?id= to open print preview for that quotation.
  useEffect(() => {
    if (loading) return;
    const id = searchParams.get('id');
    if (!id || deepLinkHandled.current === id) return;

    const qt = quotations.find((q) => q.id === id);
    if (!qt) {
      if (quotations.length > 0) {
        deepLinkHandled.current = id;
        toast.error('Quotation not found or not visible with your permissions');
      }
      return;
    }

    deepLinkHandled.current = id;
    setSearch(qt.quotation_code);
    void openPrintPreview(qt);
  }, [loading, quotations, searchParams]);

  const stats = {
    total: quotations.length,
    sent: quotations.filter((q) => q.status === 'sent').length,
    accepted: quotations.filter((q) => q.status === 'accepted').length,
    value: quotations
      .filter((q) => q.status !== 'rejected' && q.status !== 'expired')
      .reduce((sum, q) => sum + q.total, 0),
  };

  const formFields = (
    <>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-0.5">
          <Label>Customer *</Label>
          <Select
            value={form.customer_id}
            onValueChange={(v) => {
              const c = customers.find((x) => x.id === v);
              setForm({
                ...form,
                customer_id: v,
                port_of_discharge: c?.port_of_discharge || form.port_of_discharge,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label>Port of discharge</Label>
          <Input
            value={form.port_of_discharge}
            onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })}
            placeholder="Autofills from customer"
          />
        </div>
        <div className="space-y-0.5">
          <Label>Price type</Label>
          <Select
            value={form.price_type}
            onValueChange={(v: Quotation['price_type']) => {
              const policy = quoteFreightPolicy(v);
              setForm({
                ...form,
                price_type: v,
                freight: policy.allowFreight ? form.freight : '0',
                freight_notes: policy.allowFreight
                  ? form.freight_notes.trim() || policy.defaultFreightLabel
                  : '',
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOB">FOB</SelectItem>
              <SelectItem value="CNF">C&F / CNF</SelectItem>
              <SelectItem value="CIF">CIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label>Currency</Label>
          <CurrencySelect value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} />
        </div>
        <div className="space-y-0.5">
          <Label>Valid until</Label>
          <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Vehicles</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setLineItems([...lineItems, emptyQuoteLine()])}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add
          </Button>
        </div>
        <div className="space-y-2">
          {lineItems.map((item, idx) => (
            <div key={idx} className="space-y-1.5 rounded-md border border-border/60 p-2.5">
              <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-0.5 sm:col-span-2">
                  <Label>From stock</Label>
                  <Select value={item.vehicle_id || 'none'} onValueChange={(v) => applyQuoteVehicle(idx, v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Enter manually</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.stock_number} · {v.make} {v.model} · {v.chassis_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5"><Label>Chassis</Label><Input value={item.chassis_number} onChange={(e) => updateLine(idx, { chassis_number: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Make</Label><Input value={item.make} onChange={(e) => updateLine(idx, { make: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Model</Label><Input value={item.model} onChange={(e) => updateLine(idx, { model: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Year</Label><Input value={item.year} onChange={(e) => updateLine(idx, { year: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Engine</Label><Input value={item.engine} onChange={(e) => updateLine(idx, { engine: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Colour</Label><Input value={item.colour} onChange={(e) => updateLine(idx, { colour: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Transmission</Label><Input value={item.transmission} onChange={(e) => updateLine(idx, { transmission: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-0.5"><Label>Qty</Label><Input type="number" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} /></div>
                <div className="space-y-0.5"><Label>Cost</Label><Input type="number" value={item.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} /></div>
                <div className="flex items-end justify-end">
                  <Button type="button" size="icon" variant="ghost" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} aria-label="Remove vehicle">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {quoteFreightPolicy(form.price_type).allowFreight ? (
        <div className="grid gap-1.5 sm:grid-cols-4">
          <div className="space-y-0.5 sm:col-span-2">
            <Label>Ocean freight description</Label>
            <Input
              value={form.freight_notes}
              onChange={(e) => setForm({ ...form, freight_notes: e.target.value })}
              placeholder="Ocean freight"
            />
          </div>
          <div className="space-y-0.5">
            <Label>Freight ({form.currency})</Label>
            <Input type="number" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} />
          </div>
          <div className="space-y-0.5"><Label>Insurance</Label><Input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} /></div>
          <div className="space-y-0.5 sm:col-span-4 lg:col-span-1"><Label>Other fees</Label><Input type="number" value={form.other_fees} onChange={(e) => setForm({ ...form, other_fees: e.target.value })} /></div>
        </div>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-4">
          <p className="sm:col-span-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            FOB — vehicle cost only; freight is not included.
          </p>
          <div className="space-y-0.5"><Label>Insurance</Label><Input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} /></div>
          <div className="space-y-0.5"><Label>Other fees</Label><Input type="number" value={form.other_fees} onChange={(e) => setForm({ ...form, other_fees: e.target.value })} /></div>
        </div>
      )}
      <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs space-y-0.5">
        <div className="flex justify-between"><span className="text-muted-foreground">Vehicles</span><span>{form.currency} {(calcSubtotal(lineItems) + (quoteFreightPolicy(form.price_type).rollFreightIntoVehicleCost ? (Number(form.freight)||0) : 0)).toLocaleString()}</span></div>
        {quoteFreightPolicy(form.price_type).allowFreight && !quoteFreightPolicy(form.price_type).rollFreightIntoVehicleCost && (
          <div className="flex justify-between"><span className="text-muted-foreground">Ocean freight</span><span>{form.currency} {(Number(form.freight)||0).toLocaleString()}</span></div>
        )}
        <div className="flex justify-between border-t border-border pt-1 text-sm font-bold"><span>Quotation total</span><span>{form.currency} {(calcSubtotal(lineItems) + (quoteFreightPolicy(form.price_type).allowFreight ? (Number(form.freight)||0) : 0) + (Number(form.insurance)||0) + (Number(form.other_fees)||0)).toLocaleString()}</span></div>
      </div>
      <div className="space-y-0.5">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="FOB / C&F / CIF quotes with print layout matching commercial invoices"
        actions={
          <Button size="sm" onClick={() => { setForm(emptyForm); setLineItems([emptyQuoteLine()]); setCreateOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            New quotation
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total quotations', value: stats.total },
          { label: 'Sent', value: stats.sent },
          { label: 'Accepted', value: stats.accepted },
          { label: 'Pipeline value', value: stats.value.toLocaleString() },
        ].map((s) => (
          <Card key={s.label} className="erp-stat-card rounded-md shadow-sm">
            <CardContent className="p-3.5 sm:p-4">
              <p className="erp-stat-label">{s.label}</p>
              <p className="erp-stat-value">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="erp-filter-panel">
        <div className="erp-filter-bar">
          <div className="erp-filter-search">
            <Search aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotation code..." />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="erp-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading quotations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">No quotations found</h3>
            <p className="mt-1 text-sm text-muted-foreground">{isSellingFocused ? 'You only see quotations you created or that belong to your customers.' : 'Create a quotation for your customer.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filtered.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelected(q)}
                className="erp-list-row"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="erp-chip-qt" aria-hidden>
                      QT
                    </span>
                    <p className="text-sm font-medium">{q.quotation_code}</p>
                    <Badge variant="outline" className={`text-xs ${statusStyles[q.status]}`}>
                      {q.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {q.price_type}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{customerName(q.customer_id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">
                    {q.currency} {q.total.toLocaleString()}
                  </p>
                  {q.valid_until && (
                    <p className="text-xs text-muted-foreground">
                      Until {format(new Date(q.valid_until), 'MMM d')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent fullscreen>
          <DialogHeader>
            <DialogTitle>New quotation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitQuotation} className="space-y-3">
            {formFields}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.customer_id}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create quotation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent fullscreen>
          <DialogHeader>
            <DialogTitle>Edit quotation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-3">
            {formFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selected) && !printOpen} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle>{selected.quotation_code}</SheetTitle>
                <SheetDescription>
                  {customerName(selected.customer_id)} · {selected.price_type}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button size="sm" variant="outline" onClick={openPrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </Button>
                <Button size="sm" variant="outline" onClick={openEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                {canDeleteQuotation && (
                  <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={selected.status} onValueChange={(v: Quotation['status']) => updateStatus(v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {selected.currency} {selected.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Freight</span>
                    <span>
                      {selected.currency} {selected.freight.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Insurance</span>
                    <span>
                      {selected.currency} {selected.insurance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Other fees</span>
                    <span>
                      {selected.currency} {selected.other_fees.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                    <span>Total</span>
                    <span>
                      {selected.currency} {selected.total.toLocaleString()}
                    </span>
                  </div>
                </div>
                {selected.valid_until && (
                  <p className="text-sm text-muted-foreground">
                    Valid until: {format(new Date(selected.valid_until), 'MMM d, yyyy')}
                  </p>
                )}
                {selected.notes && (
                  <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {selected.notes}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DocumentPrintPreview
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="Print quotation"
        toolbar={
          selected?.verification_token ? (
            <div className="rounded-md border border-border/60 p-2.5 text-xs text-muted-foreground">
              Verify link:{' '}
              <a
                href={buildVerifyUrl(selected.verification_token).replace('/verify/', '/verify-quotation/')}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium text-foreground underline underline-offset-2"
              >
                {buildVerifyUrl(selected.verification_token).replace('/verify/', '/verify-quotation/')}
              </a>
            </div>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No verification token on this quotation — QR / link unavailable.
            </p>
          )
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              Close
            </Button>
            {selected?.verification_token ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = buildVerifyUrl(selected.verification_token!).replace(
                      '/verify/',
                      '/verify-quotation/'
                    );
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Open Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = buildVerifyUrl(selected.verification_token!).replace(
                      '/verify/',
                      '/verify-quotation/'
                    );
                    void navigator.clipboard.writeText(url);
                    toast.success('Verification link copied');
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" /> Copy Verify Link
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              onClick={async () => {
                if (!selected) return;
                await exportQuotationExcel({
                  quotation: selected,
                  items: printItems,
                  customer: customerOf(selected.customer_id),
                  verifyUrl: selected.verification_token
                    ? buildVerifyUrl(selected.verification_token).replace('/verify/', '/verify-quotation/')
                    : undefined,
                });
                toast.success('Quotation Excel downloaded');
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button
              onClick={() => {
                void printDocumentPdf(selected?.quotation_code || 'Quotation');
              }}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Print / PDF
            </Button>
          </>
        }
      >
        {selected ? (
          <CommercialQuotationTemplate
            quotation={selected}
            items={printItems}
            customer={customerOf(selected.customer_id)}
            company={companyLetterhead}
            vehicles={vehicles}
            salesAgent={profile?.full_name || profile?.email}
            verificationUrl={
              selected.verification_token
                ? buildVerifyUrl(selected.verification_token).replace('/verify/', '/verify-quotation/')
                : undefined
            }
          />
        ) : null}
      </DocumentPrintPreview>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete quotation?"
        description="This will permanently remove the quotation."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      }
    >
      <QuotationsPageInner />
    </Suspense>
  );
}
