'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
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
import type { Sale, Customer, Vehicle } from '@/lib/types';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { calcVehicleCost, formatPricingSummary, type PriceTerm } from '@/lib/utils/vehicle-pricing';
import { createReservationInvoice } from '@/lib/utils/create-reservation-invoice';
import { CarFront, ChevronRight, Loader2, Pencil, Plus, Search, Tag, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Sale['status'], string> = {
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  shipped: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  delivered: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const emptyForm = {
  customer_id: '',
  vehicle_id: '',
  sale_date: '',
  sale_price: '',
  currency: 'USD',
  deposit_amount: '',
  deposit_date: '',
  delivery_date: '',
  notes: '',
  price_term: 'FOB' as PriceTerm,
  shipment_type: 'RORO',
  container_mode: 'RORO Vessel',
  port_of_discharge: '',
  freight_usd: '0',
  insurance_usd: '0',
  create_invoice: true,
  reservation_days: '7',
  bid_jpy: '',
  exchange_rate: '150',
  markup_pct: '10',
  expense_jpy: '45000',
  profit_usd: '0',
};

export default function SalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sRes, cRes, vRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, full_name, customer_code, email, phone, country, city').order('full_name'),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number, status, purchase_price, listed_price, listed_currency, model_year, color, mileage_km, transmission, fuel_type, primary_image_url').order('created_at', { ascending: false }),
    ]);
    if (sRes.error) toast.error(`Unable to load sales: ${sRes.error.message}`);
    else setSales((sRes.data || []) as Sale[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === 'in_stock' || v.status === 'reserved'),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesSearch = !q || [s.sale_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [sales, search, statusFilter]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';
  const vehicleLabel = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.make} ${v.model} (${v.stock_number})` : 'Not linked';
  };

  const pricingPreview = useMemo(() => {
    if (!form.bid_jpy) return null;
    return calcVehicleCost({
      bidJpy: Number(form.bid_jpy),
      markupRate: (form.markup_pct === '' ? 10 : Number(form.markup_pct) || 0) / 100,
      fixedExpenseJpy: form.expense_jpy === '' ? 45000 : Number(form.expense_jpy) || 0,
      exchangeRate: Number(form.exchange_rate) || 150,
      profitUsd: Number(form.profit_usd) || 0,
      freightUsd: Number(form.freight_usd) || 0,
      insuranceUsd: Number(form.insurance_usd) || 0,
      priceTerm: form.price_term,
    });
  }, [form.bid_jpy, form.markup_pct, form.expense_jpy, form.exchange_rate, form.profit_usd, form.freight_usd, form.insurance_usd, form.price_term]);

  useEffect(() => {
    if (!form.vehicle_id) return;
    const v = vehicles.find((x) => x.id === form.vehicle_id);
    if (v?.purchase_price && !form.bid_jpy) {
      setForm((f) => ({ ...f, bid_jpy: String(v.purchase_price) }));
    }
  }, [form.vehicle_id, vehicles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pricingPreview && createOpen) {
      setForm((f) => ({
        ...f,
        sale_price: pricingPreview.sellingPriceUsd.toFixed(2),
        currency: 'USD',
      }));
    }
  }, [pricingPreview?.sellingPriceUsd, createOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id || !form.vehicle_id) return;
    setSubmitting(true);

    const salePrice = Number(form.sale_price) || 0;
    const days = Math.max(1, Number(form.reservation_days) || 7);
    const reservedUntil = new Date();
    reservedUntil.setDate(reservedUntil.getDate() + days);
    const reservedUntilStr = reservedUntil.toISOString().slice(0, 10);

    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        customer_id: form.customer_id,
        vehicle_id: form.vehicle_id,
        sale_date: form.sale_date || new Date().toISOString().split('T')[0],
        sale_price: salePrice,
        currency: form.currency || 'USD',
        deposit_amount: Number(form.deposit_amount) || 0,
        deposit_date: form.deposit_date || null,
        delivery_date: form.delivery_date || null,
        status: 'reserved',
        notes: [
          form.notes.trim(),
          `Price term: ${form.price_term}`,
          `Shipment: ${form.shipment_type} / ${form.container_mode}`,
          form.port_of_discharge ? `POD: ${form.port_of_discharge}` : '',
          `Reserved by agent: ${profile.full_name || profile.email}`,
          pricingPreview ? formatPricingSummary(pricingPreview) : '',
        ].filter(Boolean).join('\n'),
        created_by: profile.id,
      })
      .select()
      .maybeSingle();

    if (saleErr || !saleData) {
      setSubmitting(false);
      toast.error(`Could not create reservation: ${saleErr?.message || 'unknown error'}`);
      return;
    }

    const sale = saleData as Sale;

    const vehicle = vehicles.find((v) => v.id === form.vehicle_id);
    await supabase
      .from('vehicles')
      .update({
        status: 'reserved',
        reserved_until: reservedUntilStr,
        notes: [
          vehicle?.notes || '',
          `Reserved for ${customerName(form.customer_id)} by ${profile.full_name || profile.email} until ${reservedUntilStr}`,
        ].filter(Boolean).join('\n'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.vehicle_id);

    if (vehicle) {
      await supabase.from('vehicle_status_history').insert({
        vehicle_id: form.vehicle_id,
        from_status: vehicle.status,
        to_status: 'reserved',
        note: `Sale ${sale.sale_code} · ${form.price_term} · agent ${profile.full_name || profile.email}`,
        changed_by: profile.id,
      });
    }

    if (form.create_invoice) {
      const vehicleForInvoice = vehicles.find((x) => x.id === form.vehicle_id) || null;
      const invResult = await createReservationInvoice({
        customerId: form.customer_id,
        saleId: sale.id,
        vehicleId: form.vehicle_id,
        vehicle: vehicleForInvoice,
        salePrice,
        currency: form.currency || 'USD',
        priceTerm: form.price_term,
        shipmentType: form.shipment_type,
        containerMode: form.container_mode,
        portOfDischarge: form.port_of_discharge || null,
        freightUsd: Number(form.freight_usd) || 0,
        insuranceUsd: Number(form.insurance_usd) || 0,
        dueDate: reservedUntilStr,
        createdBy: profile.id,
      });
      if (!invResult.ok) {
        toast.error(`Sale reserved but invoice failed: ${invResult.error}`);
      }
    }

    setSubmitting(false);
    toast.success(`Vehicle reserved for ${customerName(form.customer_id)} until ${reservedUntilStr}`);
    setForm(emptyForm);
    setCreateOpen(false);
    loadData();
    setSelected(sale);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      ...emptyForm,
      customer_id: selected.customer_id,
      vehicle_id: selected.vehicle_id,
      sale_date: selected.sale_date,
      sale_price: String(selected.sale_price),
      currency: selected.currency,
      deposit_amount: String(selected.deposit_amount),
      deposit_date: selected.deposit_date || '',
      delivery_date: selected.delivery_date || '',
      notes: selected.notes || '',
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('sales')
      .update({
        customer_id: form.customer_id,
        vehicle_id: form.vehicle_id,
        sale_date: form.sale_date,
        sale_price: Number(form.sale_price) || 0,
        currency: form.currency,
        deposit_amount: Number(form.deposit_amount) || 0,
        deposit_date: form.deposit_date || null,
        delivery_date: form.delivery_date || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    const updated = {
      ...selected,
      customer_id: form.customer_id,
      vehicle_id: form.vehicle_id,
      sale_price: Number(form.sale_price) || 0,
      currency: form.currency,
      deposit_amount: Number(form.deposit_amount) || 0,
      deposit_date: form.deposit_date || null,
      delivery_date: form.delivery_date || null,
      notes: form.notes.trim() || null,
    };
    setSelected(updated);
    setSales((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Sale updated');
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('sales').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    toast.success('Sale deleted');
    setDeleteOpen(false);
    setSelected(null);
    loadData();
  };

  const updateStatus = async (status: Sale['status']) => {
    if (!selected) return;
    const { error } = await supabase
      .from('sales')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (status === 'paid' || status === 'confirmed') {
      await supabase
        .from('vehicles')
        .update({ status: status === 'paid' ? 'sold' : 'reserved', updated_at: new Date().toISOString() })
        .eq('id', selected.vehicle_id);
    }
    if (status === 'cancelled') {
      await supabase
        .from('vehicles')
        .update({ status: 'in_stock', reserved_until: null, updated_at: new Date().toISOString() })
        .eq('id', selected.vehicle_id);
    }
    const updated = { ...selected, status };
    setSelected(updated);
    setSales((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Sale status updated');
  };

  const stats = {
    total: sales.length,
    reserved: sales.filter((s) => s.status === 'reserved').length,
    delivered: sales.filter((s) => s.status === 'delivered').length,
    revenue: sales.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + s.sale_price, 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Reservations"
        description="Reserve stock for your customer — creates sale + optional proforma invoice"
        actions={
          <Button size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />New reservation
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total sales', value: stats.total, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Reserved', value: stats.reserved, tone: 'bg-amber-50 text-amber-600' },
          { label: 'Delivered', value: stats.delivered, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Revenue', value: stats.revenue.toLocaleString(), tone: 'bg-cyan-50 text-cyan-600' },
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
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale code..." />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading sales...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <Tag className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">No sales found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create a reservation for your customer.</p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />New reservation
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CarFront className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.sale_code}</p>
                    <Badge variant="outline" className={statusStyles[s.status]}>{s.status}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {customerName(s.customer_id)} · {vehicleLabel(s.vehicle_id)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{s.currency} {s.sale_price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(s.sale_date), 'MMM d, yyyy')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reserve vehicle for customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReservation} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>{availableVehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1"><Calculator className="h-4 w-4" /> Price calculator</p>
              <p className="text-xs text-muted-foreground">(Bid JPY + markup % + expense JPY) ÷ JPY per USD + profit, then freight / insurance by price term.</p>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                <div className="space-y-1"><Label>Bid (JPY)</Label><Input type="number" inputMode="decimal" value={form.bid_jpy} onChange={(e) => setForm({ ...form, bid_jpy: e.target.value })} /></div>
                <div className="space-y-1"><Label>Markup %</Label><Input type="number" inputMode="decimal" step="0.1" value={form.markup_pct} onChange={(e) => setForm({ ...form, markup_pct: e.target.value })} /></div>
                <div className="space-y-1"><Label>Expense (JPY)</Label><Input type="number" inputMode="decimal" value={form.expense_jpy} onChange={(e) => setForm({ ...form, expense_jpy: e.target.value })} /></div>
                <div className="space-y-1"><Label>Rate (JPY per USD)</Label><Input type="number" inputMode="decimal" step="0.01" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Profit (USD)</Label><Input type="number" inputMode="decimal" value={form.profit_usd} onChange={(e) => setForm({ ...form, profit_usd: e.target.value })} /></div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Price term</Label>
                <Select value={form.price_term} onValueChange={(v: PriceTerm) => setForm({ ...form, price_term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOB">FOB</SelectItem>
                    <SelectItem value="C&F">C&F</SelectItem>
                    <SelectItem value="CIF">CIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Shipment</Label>
                <Select value={form.shipment_type} onValueChange={(v) => setForm({ ...form, shipment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RORO">RORO</SelectItem>
                    <SelectItem value="20ft">20ft Container</SelectItem>
                    <SelectItem value="40ft">40ft Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Sold price (USD)</Label>
                <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Freight USD</Label><Input type="number" value={form.freight_usd} onChange={(e) => setForm({ ...form, freight_usd: e.target.value })} /></div>
              <div className="space-y-2"><Label>Insurance USD</Label><Input type="number" value={form.insurance_usd} onChange={(e) => setForm({ ...form, insurance_usd: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reserve days</Label><Input type="number" value={form.reservation_days} onChange={(e) => setForm({ ...form, reservation_days: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>POD (port of discharge)</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} placeholder="e.g. Mombasa, Karachi" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            {pricingPreview && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1"><Calculator className="h-3.5 w-3.5" /> Cost preview</p>
                <pre className="whitespace-pre-wrap font-mono text-[11px]">{formatPricingSummary(pricingPreview)}</pre>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reserve + Invoice'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected && !editOpen && !deleteOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.sale_code}</SheetTitle>
                <SheetDescription>{customerName(selected.customer_id)} · {vehicleLabel(selected.vehicle_id)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <p><span className="text-muted-foreground">Status:</span> {selected.status}</p>
                <p><span className="text-muted-foreground">Price:</span> {selected.currency} {selected.sale_price.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Date:</span> {format(new Date(selected.sale_date), 'MMM d, yyyy')}</p>
                {selected.notes && <pre className="whitespace-pre-wrap text-xs bg-muted/40 p-2 rounded">{selected.notes}</pre>}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                {(['confirmed', 'paid', 'shipped', 'delivered', 'cancelled'] as Sale['status'][]).map((st) => (
                  <Button key={st} size="sm" variant="secondary" onClick={() => updateStatus(st)}>{st}</Button>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit sale</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2"><Label>Sale price</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete sale?"
        description="This will permanently remove the sale record."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
