'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Quotation, Customer, Vehicle } from '@/lib/types';
import { CommercialQuotationTemplate } from '@/components/quotations/commercial-quotation-template';
import { buildVerifyUrl } from '@/components/invoices/qr-code';
import { printDocumentPdf } from '@/lib/utils/print-document-pdf';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ChevronRight, Download, FileText, Loader2, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { exportQuotationExcel } from '@/lib/utils/commercial-invoice-excel';
import { CurrencySelect } from '@/components/ui/currency-select';
import { toast } from 'sonner';
import { decodeInvoiceVehicle, describeInvoiceVehicle, formatTransmissionLabel } from '@/lib/jct-official';

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
  freight_notes: 'Container freight',
  insurance: '',
  other_fees: '',
  currency: 'USD',
  valid_until: '',
  notes: '',
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

export default function QuotationsPage() {
  const { profile } = useAuth();
  const { can, isSellingFocused } = usePermissions();
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const [qRes, cRes, vRes] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }).limit(250),
      supabase
        .from('customers')
        .select('id, full_name, customer_code, company_name, email, phone, whatsapp, country, city, address_line1, address_line2')
        .order('full_name')
        .limit(250),
      supabase
        .from('vehicles')
        .select(
          'id, stock_number, make, model, chassis_number, model_year, color, mileage_km, listed_price, listed_currency, status, transmission'
        )
        .in('status', ['in_stock', 'reserved'])
        .order('updated_at', { ascending: false })
        .limit(250),
    ]);
    if (qRes.error) toast.error(`Unable to load quotations: ${qRes.error.message}`);
    else setQuotations((qRes.data || []) as Quotation[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
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
        description: describeInvoiceVehicle({ ...item, notes: item.description }),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        line_total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
      }));

  const submitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id) return;
    const subtotal = calcSubtotal(lineItems);
    const freight = Number(form.freight) || 0;
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
        freight_notes: form.freight_notes.trim() || null,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
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
    setForm({
      customer_id: selected.customer_id,
      price_type: selected.price_type,
      freight: String(selected.freight ?? 0),
      freight_notes: selected.freight_notes || 'Container freight',
      insurance: String(selected.insurance),
      other_fees: String(selected.other_fees),
      currency: selected.currency,
      valid_until: selected.valid_until || '',
      notes: selected.notes || '',
    });
    const mapped = rows.map((item) => {
      const bits = decodeInvoiceVehicle(item.description);
      const v = vehicles.find((x) => x.id === item.vehicle_id);
      return {
        description: bits.notes || '',
        quantity: String(item.quantity ?? 1),
        unit_price: String(item.unit_price ?? 0),
        vehicle_id: item.vehicle_id || '',
        chassis_number: bits.chassis_number || v?.chassis_number || '',
        stock_number: bits.stock_number || v?.stock_number || '',
        make: bits.make || v?.make || '',
        model: bits.model || v?.model || '',
        colour: bits.colour || v?.color || '',
        year: bits.year || (v?.model_year != null ? String(v.model_year) : ''),
        engine: bits.engine || '',
        transmission: bits.transmission || formatTransmissionLabel(v?.transmission),
      };
    });
    setLineItems(mapped.length ? mapped : [emptyQuoteLine()]);
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const subtotal = calcSubtotal(lineItems);
    const freight = Number(form.freight) || 0;
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
        freight_notes: form.freight_notes.trim() || null,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
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
      freight_notes: form.freight_notes.trim() || null,
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

  const openPrint = async () => {
    if (!selected) return;
    const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', selected.id);
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
      const desc = selected.notes?.split('\n---\n').pop() || `${selected.price_type} quotation`;
      setPrintItems([
        {
          description: desc,
          quantity: 1,
          unit_price: selected.subtotal,
          line_total: selected.subtotal,
          vehicle_id: null,
        },
      ]);
    }
    setPrintOpen(true);
  };

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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
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
        <div className="space-y-2">
          <Label>Price type</Label>
          <Select
            value={form.price_type}
            onValueChange={(v: Quotation['price_type']) => setForm({ ...form, price_type: v })}
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
        <div className="space-y-2">
          <Label>Currency</Label>
          <CurrencySelect value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} />
        </div>
        <div className="space-y-2">
          <Label>Valid until</Label>
          <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Vehicles</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setLineItems([...lineItems, emptyQuoteLine()])}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add vehicle
          </Button>
        </div>
        <div className="space-y-3">
          {lineItems.map((item, idx) => (
            <div key={idx} className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">From stock (optional)</Label>
                  <Select value={item.vehicle_id || 'none'} onValueChange={(v) => applyQuoteVehicle(idx, v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not in database — enter below</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.stock_number} · {v.make} {v.model} · {v.chassis_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-[11px]">Chassis</Label><Input value={item.chassis_number} onChange={(e) => updateLine(idx, { chassis_number: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Make</Label><Input value={item.make} onChange={(e) => updateLine(idx, { make: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Model</Label><Input value={item.model} onChange={(e) => updateLine(idx, { model: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Year</Label><Input value={item.year} onChange={(e) => updateLine(idx, { year: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Engine</Label><Input value={item.engine} onChange={(e) => updateLine(idx, { engine: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Colour</Label><Input value={item.colour} onChange={(e) => updateLine(idx, { colour: e.target.value, vehicle_id: '' })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Transmission</Label><Input value={item.transmission} onChange={(e) => updateLine(idx, { transmission: e.target.value, vehicle_id: '' })} /></div>
              </div>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Label className="text-[11px]">Qty</Label><Input type="number" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} /></div>
                <div className="col-span-7"><Label className="text-[11px]">Vehicle cost</Label><Input type="number" value={item.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} /></div>
                <div className="col-span-2"><Button type="button" size="sm" variant="ghost" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Freight</Label>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Currency</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/60">
                <td className="px-3 py-2">
                  <Input value={form.freight_notes} onChange={(e) => setForm({ ...form, freight_notes: e.target.value })} placeholder="Container freight" />
                </td>
                <td className="px-3 py-2 align-middle font-medium">{form.currency}</td>
                <td className="px-3 py-2">
                  <Input type="number" className="text-right" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Insurance</Label>
          <Input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Other fees</Label>
          <Input type="number" value={form.other_fees} onChange={(e) => setForm({ ...form, other_fees: e.target.value })} />
        </div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vehicles total</span><span>{form.currency} {calcSubtotal(lineItems).toLocaleString()}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Freight</span><span>{form.currency} {(Number(form.freight)||0).toLocaleString()}</span></div>
        <div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Quotation total</span><span>{form.currency} {(calcSubtotal(lineItems) + (Number(form.freight)||0) + (Number(form.insurance)||0) + (Number(form.other_fees)||0)).toLocaleString()}</span></div>
      </div>
      <div className="space-y-2">
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
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotation code..." />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
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
        </CardContent>
      </Card>

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
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{q.quotation_code}</p>
                    <Badge variant="outline" className={statusStyles[q.status]}>
                      {q.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {q.price_type}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(q.customer_id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {q.currency} {q.total.toLocaleString()}
                  </p>
                  {q.valid_until && (
                    <p className="text-xs text-muted-foreground">
                      Valid until {format(new Date(q.valid_until), 'MMM d')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
          <form onSubmit={submitQuotation} className="space-y-4">
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
          <form onSubmit={submitEdit} className="space-y-4">
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
              <div className="space-y-4 pt-2">
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

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent fullscreen className="print:max-w-none print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Print quotation</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="overflow-x-auto print:overflow-visible">
              <div className="min-w-[720px] print:min-w-0">
                <CommercialQuotationTemplate
                  quotation={selected}
                  items={printItems}
                  customer={customerOf(selected.customer_id)}
                  vehicles={vehicles}
                  salesAgent={profile?.full_name || profile?.email}
                  verificationUrl={selected.verification_token ? buildVerifyUrl(selected.verification_token).replace('/verify/', '/verify-quotation/') : undefined}
                />
              </div>
            </div>
          )}
          <DialogFooter className="print:hidden flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              Close
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
