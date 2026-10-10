'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { exportToExcel } from '@/lib/utils/excel-export';
import { formatMoney } from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MultiImageUpload, type GalleryImage } from '@/components/shared/multi-image-upload';
import { loadVehicleImages, saveVehicleImages } from '@/lib/utils/vehicle-images';
import { VehiclesBulkImportButton } from '@/components/vehicles/vehicles-bulk-import-button';
import type { Vehicle, VehicleStatusHistory } from '@/lib/types';
import { CarFront, ChevronRight, DollarSign, Download, Loader2, MapPin, Pencil, Plus, Search, Trash2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Vehicle['status'], string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  sold: 'bg-blue-50 text-blue-700 border-blue-200',
  in_transit: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  exported: 'bg-slate-100 text-slate-600 border-slate-200',
  on_hold: 'bg-red-50 text-red-700 border-red-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};
const statusLabels: Record<Vehicle['status'], string> = {
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', in_transit: 'In transit',
  exported: 'Exported', on_hold: 'On hold', archived: 'Archived',
};
const emptyForm = {
  chassis_number: '', make: '', model: '', model_year: '', listed_price: '', listed_currency: 'USD',
  notes: '', primary_image_url: '',
};

export default function VehiclesPage() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<Vehicle['status']>('in_stock');

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('updated_at', { ascending: false });
    if (error) toast.error(`Unable to load inventory: ${error.message}`);
    else setVehicles((data || []) as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesSearch = !q || [v.stock_number, v.chassis_number, v.make, v.model].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [vehicles, search, statusFilter]);

  const openCreate = () => { setForm(emptyForm); setGallery([]); setCreateOpen(true); };

  const openEdit = async () => {
    if (!selected) return;
    const imgs = await loadVehicleImages(selected.id);
    setGallery(imgs.length ? imgs : (selected.primary_image_url ? [{ image_url: selected.primary_image_url, sort_order: 0, is_primary: true }] : []));
    setForm({
      chassis_number: selected.chassis_number,
      make: selected.make,
      model: selected.model,
      model_year: selected.model_year ? String(selected.model_year) : '',
      listed_price: selected.listed_price ? String(selected.listed_price) : '',
      listed_currency: selected.listed_currency || 'USD',
      notes: selected.notes || '',
      primary_image_url: selected.primary_image_url || '',
    });
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.chassis_number.trim() || !form.make.trim() || !form.model.trim()) return;
    setSubmitting(true);
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const { data, error } = await supabase.from('vehicles').insert({
      chassis_number: form.chassis_number.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      model_year: form.model_year ? Number(form.model_year) : null,
      listed_price: form.listed_price ? Number(form.listed_price) : null,
      listed_currency: form.listed_currency,
      notes: form.notes.trim() || null,
      primary_image_url: primary,
      created_by: profile.id,
    }).select().maybeSingle();
    if (error) { setSubmitting(false); toast.error(error.message); return; }
    if (data && gallery.length) {
      try { await saveVehicleImages((data as Vehicle).id, gallery); } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Photos save failed');
      }
    }
    setSubmitting(false);
    toast.success('Vehicle added');
    setCreateOpen(false);
    setGallery([]);
    await loadVehicles();
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await saveVehicleImages(selected.id, gallery);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Photos save failed');
    }
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const { error } = await supabase.from('vehicles').update({
      chassis_number: form.chassis_number.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      model_year: form.model_year ? Number(form.model_year) : null,
      listed_price: form.listed_price ? Number(form.listed_price) : null,
      listed_currency: form.listed_currency,
      notes: form.notes.trim() || null,
      primary_image_url: primary,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Vehicle updated');
    setEditOpen(false);
    await loadVehicles();
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    setDeleteOpen(false);
    setSelected(null);
    await loadVehicles();
  };

  const applyBulkStatus = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').update({ status: bulkStatus, updated_at: new Date().toISOString() }).in('id', Array.from(selectedIds));
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success('Bulk status updated'); setBulkStatusOpen(false); setSelectedIds(new Set()); await loadVehicles(); }
  };

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === 'in_stock').length,
    reserved: vehicles.filter((v) => v.status === 'reserved').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicle Inventory" description="Multi-photo stock · chassis · pricing"
        actions={<div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && <Button size="sm" variant="outline" onClick={() => setBulkStatusOpen(true)}>Bulk status ({selectedIds.size})</Button>}
          <VehiclesBulkImportButton onDone={loadVehicles} />
          <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add vehicle</Button>
        </div>} />

      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Total', v: stats.total }, { l: 'Available', v: stats.available }, { l: 'Reserved', v: stats.reserved }].map((s) => (
          <Card key={s.l} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <Card className="border-border/60"><CardContent className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </CardContent></Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? <div className="p-14 flex justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
          : filtered.length === 0 ? <div className="p-14 text-center text-muted-foreground">No vehicles</div>
          : <div className="divide-y">{filtered.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-4 hover:bg-muted/40">
              <Checkbox checked={selectedIds.has(v.id)} onCheckedChange={() => setSelectedIds((prev) => { const n = new Set(prev); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })} />
              <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => setSelected(v)}>
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
                  {v.primary_image_url ? <img src={v.primary_image_url} alt="" className="h-full w-full object-cover" /> : <CarFront className="h-5 w-5 text-primary" />}
                </div>
                <div className="min-w-0 flex-1"><p className="font-medium">{v.make} {v.model}</p><p className="text-xs text-muted-foreground">{v.stock_number} · {v.chassis_number}</p></div>
                <Badge variant="outline" className={statusStyles[v.status]}>{statusLabels[v.status]}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}</div>}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
        <form onSubmit={submitCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Chassis *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div>
            <div className="space-y-1"><Label>Currency</Label><Select value={form.listed_currency} onValueChange={(v) => setForm({ ...form, listed_currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['USD','JPY','PKR','EUR','GBP'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div>
          <MultiImageUpload folder={form.chassis_number.trim() || 'new'} images={gallery} onChange={setGallery} label="Vehicle photos (multiple)" />
          <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit vehicle</DialogTitle></DialogHeader>
        <form onSubmit={submitEdit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Chassis *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div></div>
          <MultiImageUpload folder={selected?.id || 'edit'} images={gallery} onChange={setGallery} label="Vehicle photos (multiple)" />
          <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Sheet open={!!selected && !editOpen && !deleteOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">{selected && (<>
          <SheetHeader><SheetTitle>{selected.make} {selected.model}</SheetTitle><SheetDescription>{selected.stock_number}</SheetDescription></SheetHeader>
          {selected.primary_image_url && <img src={selected.primary_image_url} alt="" className="mt-4 rounded-lg w-full max-h-48 object-cover" />}
          <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit + photos</Button>
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button></div>
        </>)}</SheetContent>
      </Sheet>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}><DialogContent>
        <DialogHeader><DialogTitle>Bulk status</DialogTitle></DialogHeader>
        <Select value={bulkStatus} onValueChange={(v: Vehicle['status']) => setBulkStatus(v)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        <DialogFooter><Button onClick={applyBulkStatus}>Apply</Button></DialogFooter>
      </DialogContent></Dialog>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete vehicle?" description="Removes vehicle and gallery." confirmLabel="Delete" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
