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
import type { Shipment, ShipmentItem, Vehicle } from '@/lib/types';
import { ChevronRight, Loader2, Pencil, Plus, Search, Ship, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from 'sonner';

const statusStyles: Record<Shipment['status'], string> = {
  booked: 'bg-amber-50 text-amber-700 border-amber-200', loaded: 'bg-blue-50 text-blue-700 border-blue-200', in_transit: 'bg-cyan-50 text-cyan-700 border-cyan-200', arrived: 'bg-emerald-50 text-emerald-700 border-emerald-200', delivered: 'bg-slate-100 text-slate-600 border-slate-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const emptyForm = { booking_date: '', etd: '', eta: '', vessel_name: '', voyage_number: '', port_of_loading: '', port_of_discharge: '', final_destination: '', bl_number: '', shipping_line: '', container_number: '', notes: '' };

export default function ShipmentsPage() {
  const { profile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [items, setItems] = useState<Record<string, ShipmentItem[]>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [selectedItems, setSelectedItems] = useState<ShipmentItem[]>([]);
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
    const [sRes, vRes] = await Promise.all([
      supabase.from('shipments').select('*').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number').order('created_at', { ascending: false }),
    ]);
    if (sRes.error) toast.error(`Unable to load shipments: ${sRes.error.message}`);
    else {
      const shipmentData = (sRes.data || []) as Shipment[];
      setShipments(shipmentData);
      if (shipmentData.length > 0) {
        const itemsRes = await supabase.from('shipment_items').select('*').in('shipment_id', shipmentData.map((s) => s.id));
        if (!itemsRes.error && itemsRes.data) {
          const itemMap: Record<string, ShipmentItem[]> = {};
          (itemsRes.data as ShipmentItem[]).forEach((item) => { if (!itemMap[item.shipment_id]) itemMap[item.shipment_id] = []; itemMap[item.shipment_id].push(item); });
          setItems(itemMap);
        }
      }
    }
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesSearch = !q || [s.shipment_code, s.vessel_name, s.bl_number, s.container_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [shipments, search, statusFilter]);

  const vehicleLabel = (id: string) => { const v = vehicles.find((v) => v.id === id); return v ? `${v.make} ${v.model} (${v.stock_number})` : 'Unknown'; };

  const openDetail = async (shipment: Shipment) => {
    setSelected(shipment);
    setSelectedItems(items[shipment.id] || []);
  };

  const submitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('shipments').insert({
      booking_date: form.booking_date || null, etd: form.etd || null, eta: form.eta || null,
      vessel_name: form.vessel_name.trim() || null, voyage_number: form.voyage_number.trim() || null,
      port_of_loading: form.port_of_loading.trim() || null, port_of_discharge: form.port_of_discharge.trim() || null,
      final_destination: form.final_destination.trim() || null, bl_number: form.bl_number.trim() || null,
      shipping_line: form.shipping_line.trim() || null, container_number: form.container_number.trim() || null,
      notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create shipment: ${error.message}`); return; }
    toast.success('Shipment created'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) openDetail(data as Shipment);
  };

  const openEdit = () => { if (!selected) return; setForm({ booking_date: selected.booking_date || '', etd: selected.etd || '', eta: selected.eta || '', vessel_name: selected.vessel_name || '', voyage_number: selected.voyage_number || '', port_of_loading: selected.port_of_loading || '', port_of_discharge: selected.port_of_discharge || '', final_destination: selected.final_destination || '', bl_number: selected.bl_number || '', shipping_line: selected.shipping_line || '', container_number: selected.container_number || '', notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('shipments').update({ booking_date: form.booking_date || null, etd: form.etd || null, eta: form.eta || null, vessel_name: form.vessel_name.trim() || null, voyage_number: form.voyage_number.trim() || null, port_of_loading: form.port_of_loading.trim() || null, port_of_discharge: form.port_of_discharge.trim() || null, final_destination: form.final_destination.trim() || null, bl_number: form.bl_number.trim() || null, shipping_line: form.shipping_line.trim() || null, container_number: form.container_number.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, vessel_name: form.vessel_name.trim() || null, port_of_loading: form.port_of_loading.trim() || null, port_of_discharge: form.port_of_discharge.trim() || null, bl_number: form.bl_number.trim() || null, notes: form.notes.trim() || null };
    setSelected(updated); setShipments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Shipment updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('shipments').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Shipment deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updateStatus = async (status: Shipment['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('shipments').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setShipments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Shipment status updated');
  };

  const addVehicle = async (vehicleId: string) => {
    if (!selected || !vehicleId) return;
    const { error } = await supabase.from('shipment_items').insert({ shipment_id: selected.id, vehicle_id: vehicleId });
    if (error) { toast.error(error.message); return; }
    const itemsRes = await supabase.from('shipment_items').select('*').eq('shipment_id', selected.id);
    if (itemsRes.data) setSelectedItems(itemsRes.data as ShipmentItem[]);
    toast.success('Vehicle added to shipment');
  };

  const stats = { total: shipments.length, inTransit: shipments.filter((s) => s.status === 'in_transit').length, delivered: shipments.filter((s) => s.status === 'delivered').length, booked: shipments.filter((s) => s.status === 'booked').length };

  return (
    <div className="space-y-6">
      <PageHeader title="Shipping & Shipments" description="Track shipments from booking to destination delivery" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New shipment</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total shipments', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Booked', value: stats.booked, tone: 'bg-amber-50 text-amber-600' },
        { label: 'In transit', value: stats.inTransit, tone: 'bg-cyan-50 text-cyan-600' }, { label: 'Delivered', value: stats.delivered, tone: 'bg-emerald-50 text-emerald-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, vessel, B/L, container..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="booked">Booked</SelectItem><SelectItem value="loaded">Loaded</SelectItem><SelectItem value="in_transit">In Transit</SelectItem><SelectItem value="arrived">Arrived</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading shipments...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Ship className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No shipments found</h3><p className="mt-1 text-sm text-muted-foreground">Create a shipment or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((s) => <button key={s.id} onClick={() => openDetail(s)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Ship className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{s.shipment_code}</p><Badge variant="outline" className={statusStyles[s.status]}>{s.status.replace('_', ' ')}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{s.vessel_name || 'No vessel'}{s.port_of_loading ? ` · ${s.port_of_loading}` : ''}{s.port_of_discharge ? ` → ${s.port_of_discharge}` : ''}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">{s.etd ? `ETD ${format(new Date(s.etd), 'MMM d')}` : ''}</p><p className="text-xs text-muted-foreground">{s.eta ? `ETA ${format(new Date(s.eta), 'MMM d')}` : ''}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New shipment</DialogTitle></DialogHeader><form onSubmit={submitShipment} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Vessel name</Label><Input value={form.vessel_name} onChange={(e) => setForm({ ...form, vessel_name: e.target.value })} /></div><div className="space-y-2"><Label>Voyage number</Label><Input value={form.voyage_number} onChange={(e) => setForm({ ...form, voyage_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Booking date</Label><Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></div><div className="space-y-2"><Label>ETD</Label><Input type="date" value={form.etd} onChange={(e) => setForm({ ...form, etd: e.target.value })} /></div><div className="space-y-2"><Label>ETA</Label><Input type="date" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Port of loading</Label><Input value={form.port_of_loading} onChange={(e) => setForm({ ...form, port_of_loading: e.target.value })} /></div><div className="space-y-2"><Label>Port of discharge</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Final destination</Label><Input value={form.final_destination} onChange={(e) => setForm({ ...form, final_destination: e.target.value })} /></div><div className="space-y-2"><Label>B/L number</Label><Input value={form.bl_number} onChange={(e) => setForm({ ...form, bl_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Shipping line</Label><Input value={form.shipping_line} onChange={(e) => setForm({ ...form, shipping_line: e.target.value })} /></div><div className="space-y-2"><Label>Container number</Label><Input value={form.container_number} onChange={(e) => setForm({ ...form, container_number: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create shipment'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.shipment_code}</SheetTitle><SheetDescription>{selected.vessel_name || 'No vessel assigned'}{selected.voyage_number ? ` · Voyage ${selected.voyage_number}` : ''}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Status:</span><Select value={selected.status} onValueChange={(v: Shipment['status']) => updateStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="booked">Booked</SelectItem><SelectItem value="loaded">Loaded</SelectItem><SelectItem value="in_transit">In Transit</SelectItem><SelectItem value="arrived">Arrived</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3">{[
          { label: 'Port of loading', value: selected.port_of_loading }, { label: 'Port of discharge', value: selected.port_of_discharge },
          { label: 'ETD', value: selected.etd ? format(new Date(selected.etd), 'MMM d, yyyy') : null }, { label: 'ETA', value: selected.eta ? format(new Date(selected.eta), 'MMM d, yyyy') : null },
          { label: 'B/L number', value: selected.bl_number }, { label: 'Container', value: selected.container_number },
        ].map((f) => <div key={f.label} className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p><p className="mt-1 text-sm">{f.value || 'Not set'}</p></div>)}</div><section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Vehicles in shipment</h3><Select onValueChange={addVehicle}><SelectTrigger className="w-48"><SelectValue placeholder="Add vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div>{selectedItems.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No vehicles added yet.</p> : <div className="space-y-2">{selectedItems.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><Ship className="h-4 w-4 text-muted-foreground" /></div><p className="text-sm font-medium">{vehicleLabel(item.vehicle_id)}</p></div>)}</div>}</section>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div></>}</></SheetContent></Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit shipment</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Vessel name</Label><Input value={form.vessel_name} onChange={(e) => setForm({ ...form, vessel_name: e.target.value })} /></div><div className="space-y-2"><Label>Voyage number</Label><Input value={form.voyage_number} onChange={(e) => setForm({ ...form, voyage_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Booking date</Label><Input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></div><div className="space-y-2"><Label>ETD</Label><Input type="date" value={form.etd} onChange={(e) => setForm({ ...form, etd: e.target.value })} /></div><div className="space-y-2"><Label>ETA</Label><Input type="date" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Port of loading</Label><Input value={form.port_of_loading} onChange={(e) => setForm({ ...form, port_of_loading: e.target.value })} /></div><div className="space-y-2"><Label>Port of discharge</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Final destination</Label><Input value={form.final_destination} onChange={(e) => setForm({ ...form, final_destination: e.target.value })} /></div><div className="space-y-2"><Label>B/L number</Label><Input value={form.bl_number} onChange={(e) => setForm({ ...form, bl_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Shipping line</Label><Input value={form.shipping_line} onChange={(e) => setForm({ ...form, shipping_line: e.target.value })} /></div><div className="space-y-2"><Label>Container number</Label><Input value={form.container_number} onChange={(e) => setForm({ ...form, container_number: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete shipment?" description="This will permanently remove the shipment record. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
