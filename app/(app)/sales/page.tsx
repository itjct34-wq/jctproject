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
import { CarFront, ChevronRight, Loader2, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Sale['status'], string> = {
  reserved: 'bg-amber-50 text-amber-700 border-amber-200', confirmed: 'bg-blue-50 text-blue-700 border-blue-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', shipped: 'bg-cyan-50 text-cyan-700 border-cyan-200', delivered: 'bg-slate-100 text-slate-600 border-slate-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const emptyForm = { customer_id: '', vehicle_id: '', sale_date: '', sale_price: '', currency: 'JPY', deposit_amount: '', deposit_date: '', delivery_date: '', notes: '' };

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
      supabase.from('customers').select('id, full_name, customer_code').order('full_name'),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number').order('created_at', { ascending: false }),
    ]);
    if (sRes.error) toast.error(`Unable to load sales: ${sRes.error.message}`);
    else setSales((sRes.data || []) as Sale[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesSearch = !q || [s.sale_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [sales, search, statusFilter]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';
  const vehicleLabel = (id: string) => { const v = vehicles.find((v) => v.id === id); return v ? `${v.make} ${v.model} (${v.stock_number})` : 'Not linked'; };

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id || !form.vehicle_id) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('sales').insert({
      customer_id: form.customer_id, vehicle_id: form.vehicle_id, sale_date: form.sale_date || new Date().toISOString().split('T')[0],
      sale_price: Number(form.sale_price) || 0, currency: form.currency, deposit_amount: Number(form.deposit_amount) || 0,
      deposit_date: form.deposit_date || null, delivery_date: form.delivery_date || null, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create sale: ${error.message}`); return; }
    toast.success('Sale created'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) setSelected(data as Sale);
  };

  const openEdit = () => { if (!selected) return; setForm({ customer_id: selected.customer_id, vehicle_id: selected.vehicle_id, sale_date: selected.sale_date, sale_price: String(selected.sale_price), currency: selected.currency, deposit_amount: String(selected.deposit_amount), deposit_date: selected.deposit_date || '', delivery_date: selected.delivery_date || '', notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('sales').update({ customer_id: form.customer_id, vehicle_id: form.vehicle_id, sale_date: form.sale_date, sale_price: Number(form.sale_price) || 0, currency: form.currency, deposit_amount: Number(form.deposit_amount) || 0, deposit_date: form.deposit_date || null, delivery_date: form.delivery_date || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, customer_id: form.customer_id, vehicle_id: form.vehicle_id, sale_price: Number(form.sale_price) || 0, currency: form.currency, deposit_amount: Number(form.deposit_amount) || 0, deposit_date: form.deposit_date || null, delivery_date: form.delivery_date || null, notes: form.notes.trim() || null };
    setSelected(updated); setSales((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Sale updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('sales').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Sale deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updateStatus = async (status: Sale['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('sales').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setSales((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Sale status updated');
  };

  const stats = { total: sales.length, reserved: sales.filter((s) => s.status === 'reserved').length, delivered: sales.filter((s) => s.status === 'delivered').length, revenue: sales.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + s.sale_price, 0) };

  return (
    <div className="space-y-6">
      <PageHeader title="Sales & Reservations" description="Sales pipeline, vehicle reservations, and order management" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New sale</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total sales', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Reserved', value: stats.reserved, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Delivered', value: stats.delivered, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Revenue', value: stats.revenue.toLocaleString(), tone: 'bg-cyan-50 text-cyan-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sale code..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="shipped">Shipped</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading sales...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Tag className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No sales found</h3><p className="mt-1 text-sm text-muted-foreground">Create a sale or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((s) => <button key={s.id} onClick={() => setSelected(s)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CarFront className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{s.sale_code}</p><Badge variant="outline" className={statusStyles[s.status]}>{s.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(s.customer_id)} · {vehicleLabel(s.vehicle_id)}</p></div><div className="text-right"><p className="text-sm font-semibold">{s.currency} {s.sale_price.toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(s.sale_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New sale</DialogTitle></DialogHeader><form onSubmit={submitSale} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer *</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vehicle *</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Sale date</Label><Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></div><div className="space-y-2"><Label>Sale price</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Deposit amount</Label><Input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></div><div className="space-y-2"><Label>Deposit date</Label><Input type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} /></div><div className="space-y-2"><Label>Delivery date</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.customer_id || !form.vehicle_id}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create sale'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.sale_code}</SheetTitle><SheetDescription>{customerName(selected.customer_id)} · {vehicleLabel(selected.vehicle_id)}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Status:</span><Select value={selected.status} onValueChange={(v: Sale['status']) => updateStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reserved">Reserved</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="shipped">Shipped</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sale price</p><p className="mt-1 text-sm font-semibold">{selected.currency} {selected.sale_price.toLocaleString()}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deposit</p><p className="mt-1 text-sm font-semibold">{selected.currency} {selected.deposit_amount.toLocaleString()}</p><p className="text-xs text-muted-foreground">{selected.deposit_date ? format(new Date(selected.deposit_date), 'MMM d, yyyy') : 'No deposit'}</p></div></div>{selected.delivery_date && <p className="text-sm text-muted-foreground">Delivery: {format(new Date(selected.delivery_date), 'MMM d, yyyy')}</p>}{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div></>}</></SheetContent></Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit sale</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer *</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vehicle *</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Sale date</Label><Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></div><div className="space-y-2"><Label>Sale price</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Deposit amount</Label><Input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></div><div className="space-y-2"><Label>Deposit date</Label><Input type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} /></div><div className="space-y-2"><Label>Delivery date</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete sale?" description="This will permanently remove the sale record. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
