'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
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
  chassis_number: '', make: '', model: '', model_grade: '', model_year: '', registration_year: '',
  color: '', mileage_km: '', transmission: 'automatic' as NonNullable<Vehicle['transmission']>,
  fuel_type: 'petrol' as NonNullable<Vehicle['fuel_type']>, source_country: 'Japan', source_supplier: '',
  purchase_price: '', purchase_currency: 'JPY', listed_price: '', listed_currency: 'USD',
  location: '', arrival_date: '', notes: '', primary_image_url: '',
};

export default function VehiclesPage() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [history, setHistory] = useState<VehicleStatusHistory[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  const loadHistory = useCallback(async (vehicle: Vehicle) => {
    setSelected(vehicle); setDetailLoading(true);
    const { data, error } = await supabase.from('vehicle_status_history').select('*').eq('vehicle_id', vehicle.id).order('created_at', { ascending: false });
    if (error) toast.error(`Unable to load history: ${error.message}`);
    setHistory((data || []) as VehicleStatusHistory[]); setDetailLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesSearch = !q || [v.stock_number, v.chassis_number, v.make, v.model, v.source_country, v.location].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [vehicles, search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };
  const openEdit = () => {
    if (!selected) return;
    setForm({
      chassis_number: selected.chassis_number, make: selected.make, model: selected.model,
      model_grade: selected.model_grade || '', model_year: selected.model_year ? String(selected.model_year) : '',
      registration_year: selected.registration_year ? String(selected.registration_year) : '',
      color: selected.color || '', mileage_km: selected.mileage_km ? String(selected.mileage_km) : '',
      transmission: selected.transmission || 'automatic', fuel_type: selected.fuel_type || 'petrol',
      source_country: selected.source_country || 'Japan', source_supplier: selected.source_supplier || '',
      purchase_price: selected.purchase_price ? String(selected.purchase_price) : '',
      purchase_currency: selected.purchase_currency, listed_price: selected.listed_price ? String(selected.listed_price) : '',
      listed_currency: selected.listed_currency, location: selected.location || '',
      arrival_date: selected.arrival_date || '', notes: selected.notes || '',
      primary_image_url: selected.primary_image_url || '',
    });
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.chassis_number.trim() || !form.make.trim() || !form.model.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('vehicles').insert({
      chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(),
      model_grade: form.model_grade.trim() || null, model_year: form.model_year ? Number(form.model_year) : null,
      registration_year: form.registration_year ? Number(form.registration_year) : null,
      color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
      transmission: form.transmission, fuel_type: form.fuel_type,
      source_country: form.source_country.trim() || null, source_supplier: form.source_supplier.trim() || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null, purchase_currency: form.purchase_currency,
      listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency,
      location: form.location.trim() || null, arrival_date: form.arrival_date || null,
      notes: form.notes.trim() || null, primary_image_url: form.primary_image_url.trim() || null,
      created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'This chassis number already exists' : `Could not add vehicle: ${error.message}`); return; }
    toast.success('Vehicle added to inventory'); setForm(emptyForm); setCreateOpen(false); await loadVehicles();
    if (data) await loadHistory(data as Vehicle);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').update({
      chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(),
      model_grade: form.model_grade.trim() || null, model_year: form.model_year ? Number(form.model_year) : null,
      registration_year: form.registration_year ? Number(form.registration_year) : null,
      color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
      transmission: form.transmission, fuel_type: form.fuel_type,
      source_country: form.source_country.trim() || null, source_supplier: form.source_supplier.trim() || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null, purchase_currency: form.purchase_currency,
      listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency,
      location: form.location.trim() || null, arrival_date: form.arrival_date || null,
      notes: form.notes.trim() || null, primary_image_url: form.primary_image_url.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    // Build a typed Vehicle without spreading form (form fields are strings)
    const updated: Vehicle = {
      ...selected,
      chassis_number: form.chassis_number.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      model_grade: form.model_grade.trim() || null,
      model_year: form.model_year ? Number(form.model_year) : null,
      registration_year: form.registration_year ? Number(form.registration_year) : null,
      color: form.color.trim() || null,
      mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
      transmission: form.transmission,
      fuel_type: form.fuel_type,
      source_country: form.source_country.trim() || null,
      source_supplier: form.source_supplier.trim() || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_currency: form.purchase_currency,
      listed_price: form.listed_price ? Number(form.listed_price) : null,
      listed_currency: form.listed_currency,
      location: form.location.trim() || null,
      arrival_date: form.arrival_date || null,
      notes: form.notes.trim() || null,
      primary_image_url: form.primary_image_url.trim() || null,
    };
    setSelected(updated); setVehicles((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Vehicle updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Vehicle deleted'); setDeleteOpen(false); setSelected(null); await loadVehicles();
  };

  const updateStatus = async (status: Vehicle['status']) => {
    if (!selected || !profile || status === selected.status) return;
    const prev = selected.status;
    const { error } = await supabase.from('vehicles').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('vehicle_status_history').insert({ vehicle_id: selected.id, from_status: prev, to_status: status, changed_by: profile.id });
    const updated = { ...selected, status }; setSelected(updated);
    setVehicles((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    await loadHistory(updated); toast.success('Vehicle status updated');
  };

  const applyBulkStatus = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('vehicles').update({ status: bulkStatus, updated_at: new Date().toISOString() }).in('id', ids);
    setSubmitting(false);
    if (error) { toast.error(`Bulk update failed: ${error.message}`); return; }
    toast.success(`${ids.length} vehicle(s) updated to ${statusLabels[bulkStatus]}`);
    setBulkStatusOpen(false); setSelectedIds(new Set()); await loadVehicles();
  };

  const handleExport = async (exportAll: boolean) => {
    const rows = (exportAll ? filtered : filtered.filter((v) => selectedIds.has(v.id))).map((v) => ({
      stock: v.stock_number, chassis: v.chassis_number, make: v.make, model: v.model,
      year: v.model_year || '', listed_price: v.listed_price || 0, currency: v.listed_currency,
      status: statusLabels[v.status],
    }));
    await exportToExcel('vehicles-export', 'Vehicles', [
      { header: 'Stock #', key: 'stock', width: 14 }, { header: 'Chassis', key: 'chassis', width: 20 },
      { header: 'Make', key: 'make', width: 14 }, { header: 'Model', key: 'model', width: 16 },
      { header: 'Year', key: 'year', width: 8 }, { header: 'Listed Price', key: 'listed_price', width: 14 },
      { header: 'Currency', key: 'currency', width: 10 }, { header: 'Status', key: 'status', width: 12 },
    ], rows, { title: 'Vehicle Export', details: { 'Total Records': String(rows.length) } });
    toast.success(`${rows.length} vehicle(s) exported`);
  };

  const stockAge = (v: Vehicle): number | null => v.arrival_date ? differenceInCalendarDays(new Date(), new Date(v.arrival_date)) : null;
  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === 'in_stock').length,
    reserved: vehicles.filter((v) => v.status === 'reserved').length,
    ageing: vehicles.filter((v) => (stockAge(v) || 0) > 90 && v.status === 'in_stock').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Inventory"
        description="Manage chassis, stock ageing, pricing, and export readiness"
        actions={
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkStatusOpen(true)}>
                Bulk status ({selectedIds.size})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleExport(false)} disabled={selectedIds.size === 0}>
              <Download className="mr-1.5 h-4 w-4" />Export selected
            </Button>
            <VehiclesBulkImportButton onDone={loadVehicles} />
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />Add vehicle
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total stock', value: stats.total },
          { label: 'Available', value: stats.available },
          { label: 'Reserved', value: stats.reserved },
          { label: 'Ageing > 90 days', value: stats.ageing },
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
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock, chassis, make, model..." />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => handleExport(true)}>
              <Download className="mr-1.5 h-4 w-4" />Export all
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading inventory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <Warehouse className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">No vehicles found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add stock or use Bulk import CSV.</p>
            <div className="mt-4 flex gap-2">
              <VehiclesBulkImportButton onDone={loadVehicles} />
              <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add vehicle</Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filtered.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40">
                <Checkbox checked={selectedIds.has(v.id)} onCheckedChange={() => toggleSelect(v.id)} />
                <button onClick={() => loadHistory(v)} className="flex flex-1 items-center gap-4 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                    {v.primary_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.primary_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CarFront className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{v.make} {v.model}</p>
                      <Badge variant="outline" className={statusStyles[v.status]}>{statusLabels[v.status]}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {v.stock_number} · {v.chassis_number}{v.model_year ? ` · ${v.model_year}` : ''}
                    </p>
                  </div>
                  <div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.location || 'Location pending'}</span>
                    {v.listed_price != null && (
                      <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatMoney(v.listed_price, v.listed_currency)}</span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Add vehicle to inventory</DialogTitle></DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Chassis number *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Source country</Label><Input value={form.source_country} onChange={(e) => setForm({ ...form, source_country: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Listed currency</Label>
                <Select value={form.listed_currency} onValueChange={(v) => setForm({ ...form, listed_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','JPY','PKR','EUR','GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Image URL</Label><Input value={form.primary_image_url} onChange={(e) => setForm({ ...form, primary_image_url: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add vehicle'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit vehicle</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Chassis *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Image URL</Label><Input value={form.primary_image_url} onChange={(e) => setForm({ ...form, primary_image_url: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Currency</Label>
                <Select value={form.listed_currency} onValueChange={(v) => setForm({ ...form, listed_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','JPY','PKR','EUR','GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected && !editOpen && !deleteOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.make} {selected.model}</SheetTitle>
                <SheetDescription>{selected.stock_number} · {selected.chassis_number}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2 text-sm">
                <p>Status: {statusLabels[selected.status]}</p>
                {selected.listed_price != null && <p>Price: {formatMoney(selected.listed_price, selected.listed_currency)}</p>}
                {selected.primary_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.primary_image_url} alt="" className="mt-2 rounded-lg w-full object-cover max-h-40" />
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
                {(['in_stock', 'reserved', 'sold', 'on_hold'] as Vehicle['status'][]).map((st) => (
                  <Button key={st} size="sm" variant="secondary" onClick={() => updateStatus(st)}>{statusLabels[st]}</Button>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk status update</DialogTitle></DialogHeader>
          <Select value={bulkStatus} onValueChange={(v: Vehicle['status']) => setBulkStatus(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkStatus} disabled={submitting}>Apply to {selectedIds.size}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete vehicle?"
        description="This permanently removes the vehicle record."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
