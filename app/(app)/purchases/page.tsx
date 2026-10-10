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
import type { Purchase, Supplier, Vehicle } from '@/lib/types';
import { ChevronRight, Loader2, Package, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { CurrencySelect } from '@/components/ui/currency-select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from 'sonner';

const statusStyles: Record<Purchase['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200', confirmed: 'bg-blue-50 text-blue-700 border-blue-200', invoiced: 'bg-amber-50 text-amber-700 border-amber-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const emptyForm = { supplier_id: '', vehicle_id: '', purchase_date: '', vehicle_price: '', auction_fees: '', transport_cost: '', inspection_cost: '', other_cost: '', currency: 'JPY', notes: '' };

export default function PurchasesPage() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Purchase | null>(null);
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
    const [pRes, sRes, vRes] = await Promise.all([
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, name, supplier_code').order('name'),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number').order('created_at', { ascending: false }),
    ]);
    if (pRes.error) toast.error(`Unable to load purchases: ${pRes.error.message}`);
    else setPurchases((pRes.data || []) as Purchase[]);
    if (sRes.data) setSuppliers(sRes.data as Supplier[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = !q || [p.purchase_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [purchases, search, statusFilter]);

  const totalCost = (p: Purchase) => p.vehicle_price + p.auction_fees + p.transport_cost + p.inspection_cost + p.other_cost;

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('purchases').insert({
      supplier_id: form.supplier_id || null, vehicle_id: form.vehicle_id || null, purchase_date: form.purchase_date || new Date().toISOString().split('T')[0],
      vehicle_price: Number(form.vehicle_price) || 0, auction_fees: Number(form.auction_fees) || 0, transport_cost: Number(form.transport_cost) || 0,
      inspection_cost: Number(form.inspection_cost) || 0, other_cost: Number(form.other_cost) || 0, currency: form.currency, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create purchase: ${error.message}`); return; }
    toast.success('Purchase order created'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) setSelected(data as Purchase);
  };

  const openEdit = () => { if (!selected) return; setForm({ supplier_id: selected.supplier_id || '', vehicle_id: selected.vehicle_id || '', purchase_date: selected.purchase_date, vehicle_price: String(selected.vehicle_price), auction_fees: String(selected.auction_fees), transport_cost: String(selected.transport_cost), inspection_cost: String(selected.inspection_cost), other_cost: String(selected.other_cost), currency: selected.currency, notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('purchases').update({ supplier_id: form.supplier_id || null, vehicle_id: form.vehicle_id || null, purchase_date: form.purchase_date, vehicle_price: Number(form.vehicle_price) || 0, auction_fees: Number(form.auction_fees) || 0, transport_cost: Number(form.transport_cost) || 0, inspection_cost: Number(form.inspection_cost) || 0, other_cost: Number(form.other_cost) || 0, currency: form.currency, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, supplier_id: form.supplier_id || null, vehicle_id: form.vehicle_id || null, vehicle_price: Number(form.vehicle_price) || 0, auction_fees: Number(form.auction_fees) || 0, transport_cost: Number(form.transport_cost) || 0, inspection_cost: Number(form.inspection_cost) || 0, other_cost: Number(form.other_cost) || 0, notes: form.notes.trim() || null };
    setSelected(updated); setPurchases((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Purchase updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('purchases').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Purchase deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updateStatus = async (status: Purchase['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('purchases').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setPurchases((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Purchase status updated');
  };

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name || 'Unknown';
  const vehicleLabel = (id: string | null) => { const v = vehicles.find((v) => v.id === id); return v ? `${v.make} ${v.model} (${v.stock_number})` : 'Not linked'; };

  const stats = { total: purchases.length, draft: purchases.filter((p) => p.status === 'draft').length, confirmed: purchases.filter((p) => p.status === 'confirmed').length, totalCost: purchases.filter((p) => p.status !== 'cancelled').reduce((sum, p) => sum + totalCost(p), 0) };

  return (
    <div className="space-y-6">
      <PageHeader title="Auction Purchases" description="Purchase orders, cost breakdowns, and supplier payment tracking" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New purchase</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total purchases', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Drafts', value: stats.draft, tone: 'bg-slate-50 text-slate-600' },
        { label: 'Confirmed', value: stats.confirmed, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Total cost', value: `${stats.totalCost.toLocaleString()}`, tone: 'bg-amber-50 text-amber-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchase code..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="invoiced">Invoiced</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading purchases...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No purchases found</h3><p className="mt-1 text-sm text-muted-foreground">Create a purchase order or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((p) => <button key={p.id} onClick={() => setSelected(p)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.purchase_code}</p><Badge variant="outline" className={statusStyles[p.status]}>{p.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{supplierName(p.supplier_id)} · {vehicleLabel(p.vehicle_id)}</p></div><div className="text-right"><p className="text-sm font-semibold">{p.currency} {totalCost(p).toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(p.purchase_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader><form onSubmit={submitPurchase} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Supplier</Label><Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vehicle</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div><div className="space-y-2"><Label>Vehicle price</Label><Input type="number" value={form.vehicle_price} onChange={(e) => setForm({ ...form, vehicle_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><CurrencySelect value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Auction fees</Label><Input type="number" value={form.auction_fees} onChange={(e) => setForm({ ...form, auction_fees: e.target.value })} /></div><div className="space-y-2"><Label>Transport cost</Label><Input type="number" value={form.transport_cost} onChange={(e) => setForm({ ...form, transport_cost: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Inspection cost</Label><Input type="number" value={form.inspection_cost} onChange={(e) => setForm({ ...form, inspection_cost: e.target.value })} /></div><div className="space-y-2"><Label>Other cost</Label><Input type="number" value={form.other_cost} onChange={(e) => setForm({ ...form, other_cost: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create purchase'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.purchase_code}</SheetTitle><SheetDescription>{supplierName(selected.supplier_id)} · {vehicleLabel(selected.vehicle_id)}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Status:</span><Select value={selected.status} onValueChange={(v: Purchase['status']) => updateStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="invoiced">Invoiced</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Vehicle price</span><span>{selected.currency} {selected.vehicle_price.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Auction fees</span><span>{selected.currency} {selected.auction_fees.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Transport</span><span>{selected.currency} {selected.transport_cost.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Inspection</span><span>{selected.currency} {selected.inspection_cost.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Other</span><span>{selected.currency} {selected.other_cost.toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total cost</span><span>{selected.currency} {totalCost(selected).toLocaleString()}</span></div></div>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div></>}</></SheetContent></Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit purchase order</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Supplier</Label><Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Vehicle</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div><div className="space-y-2"><Label>Vehicle price</Label><Input type="number" value={form.vehicle_price} onChange={(e) => setForm({ ...form, vehicle_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Auction fees</Label><Input type="number" value={form.auction_fees} onChange={(e) => setForm({ ...form, auction_fees: e.target.value })} /></div><div className="space-y-2"><Label>Transport cost</Label><Input type="number" value={form.transport_cost} onChange={(e) => setForm({ ...form, transport_cost: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Inspection cost</Label><Input type="number" value={form.inspection_cost} onChange={(e) => setForm({ ...form, inspection_cost: e.target.value })} /></div><div className="space-y-2"><Label>Other cost</Label><Input type="number" value={form.other_cost} onChange={(e) => setForm({ ...form, other_cost: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete purchase?" description="This will permanently remove the purchase order. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
