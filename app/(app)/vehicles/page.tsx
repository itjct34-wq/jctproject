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
import type { Vehicle, VehicleStatusHistory } from '@/lib/types';
import { Archive, CarFront, CheckCircle2, ChevronRight, Clock3, DollarSign, Download, Loader2, MapPin, Pencil, Plus, Search, Tag, Trash2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Vehicle['status'], string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200', reserved: 'bg-amber-50 text-amber-700 border-amber-200', sold: 'bg-blue-50 text-blue-700 border-blue-200', in_transit: 'bg-cyan-50 text-cyan-700 border-cyan-200', exported: 'bg-slate-100 text-slate-600 border-slate-200', on_hold: 'bg-red-50 text-red-700 border-red-200', archived: 'bg-slate-100 text-slate-500 border-slate-200',
};
const statusLabels: Record<Vehicle['status'], string> = {
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', in_transit: 'In transit', exported: 'Exported', on_hold: 'On hold', archived: 'Archived',
};
const emptyForm = { chassis_number: '', make: '', model: '', model_grade: '', model_year: '', registration_year: '', color: '', mileage_km: '', transmission: 'automatic' as NonNullable<Vehicle['transmission']>, fuel_type: 'petrol' as NonNullable<Vehicle['fuel_type']>, source_country: 'Japan', source_supplier: '', purchase_price: '', purchase_currency: 'JPY', listed_price: '', listed_currency: 'JPY', location: '', arrival_date: '', notes: '' };

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

  // Sync top-bar global search (?q=) into local filter
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
  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id)));
  };

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };
  const openEdit = () => {
    if (!selected) return;
    setForm({ chassis_number: selected.chassis_number, make: selected.make, model: selected.model, model_grade: selected.model_grade || '', model_year: selected.model_year ? String(selected.model_year) : '', registration_year: selected.registration_year ? String(selected.registration_year) : '', color: selected.color || '', mileage_km: selected.mileage_km ? String(selected.mileage_km) : '', transmission: selected.transmission || 'automatic', fuel_type: selected.fuel_type || 'petrol', source_country: selected.source_country || 'Japan', source_supplier: selected.source_supplier || '', purchase_price: selected.purchase_price ? String(selected.purchase_price) : '', purchase_currency: selected.purchase_currency, listed_price: selected.listed_price ? String(selected.listed_price) : '', listed_currency: selected.listed_currency, location: selected.location || '', arrival_date: selected.arrival_date || '', notes: selected.notes || '' });
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.chassis_number.trim() || !form.make.trim() || !form.model.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('vehicles').insert({ chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(), model_grade: form.model_grade.trim() || null, model_year: form.model_year ? Number(form.model_year) : null, registration_year: form.registration_year ? Number(form.registration_year) : null, color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null, transmission: form.transmission, fuel_type: form.fuel_type, source_country: form.source_country.trim() || null, source_supplier: form.source_supplier.trim() || null, purchase_price: form.purchase_price ? Number(form.purchase_price) : null, purchase_currency: form.purchase_currency, listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency, location: form.location.trim() || null, arrival_date: form.arrival_date || null, notes: form.notes.trim() || null, created_by: profile.id }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'This chassis number already exists' : `Could not add vehicle: ${error.message}`); return; }
    toast.success('Vehicle added to inventory'); setForm(emptyForm); setCreateOpen(false); await loadVehicles();
    if (data) await loadHistory(data as Vehicle);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').update({ chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(), model_grade: form.model_grade.trim() || null, model_year: form.model_year ? Number(form.model_year) : null, registration_year: form.registration_year ? Number(form.registration_year) : null, color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null, transmission: form.transmission, fuel_type: form.fuel_type, source_country: form.source_country.trim() || null, source_supplier: form.source_supplier.trim() || null, purchase_price: form.purchase_price ? Number(form.purchase_price) : null, purchase_currency: form.purchase_currency, listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency, location: form.location.trim() || null, arrival_date: form.arrival_date || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'This chassis number already exists' : `Could not update: ${error.message}`); return; }
    const updated = { ...selected, chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(), model_grade: form.model_grade.trim() || null, model_year: form.model_year ? Number(form.model_year) : null, color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null, listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency, location: form.location.trim() || null, notes: form.notes.trim() || null };
    setSelected(updated); setVehicles((items) => items.map((i) => i.id === updated.id ? updated : i));
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
    setVehicles((items) => items.map((i) => i.id === updated.id ? updated : i));
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
    const rows = (exportAll ? filtered : filtered.filter((v) => selectedIds.has(v.id))).map((v) => ({ stock: v.stock_number, chassis: v.chassis_number, make: v.make, model: v.model, grade: v.model_grade || '', year: v.model_year || '', color: v.color || '', mileage: v.mileage_km || 0, fuel: v.fuel_type || '', transmission: v.transmission || '', country: v.source_country || '', location: v.location || '', purchase_price: v.purchase_price || 0, listed_price: v.listed_price || 0, currency: v.listed_currency, status: statusLabels[v.status], arrival: v.arrival_date ? format(new Date(v.arrival_date), 'yyyy-MM-dd') : '' }));
    await exportToExcel('vehicles-export', 'Vehicles', [
      { header: 'Stock #', key: 'stock', width: 14 }, { header: 'Chassis', key: 'chassis', width: 20 }, { header: 'Make', key: 'make', width: 14 }, { header: 'Model', key: 'model', width: 16 }, { header: 'Grade', key: 'grade', width: 12 }, { header: 'Year', key: 'year', width: 8 }, { header: 'Color', key: 'color', width: 12 }, { header: 'Mileage (km)', key: 'mileage', width: 14, format: '#,##0' }, { header: 'Fuel', key: 'fuel', width: 10 }, { header: 'Transmission', key: 'transmission', width: 12 }, { header: 'Country', key: 'country', width: 12 }, { header: 'Location', key: 'location', width: 14 }, { header: 'Purchase Price', key: 'purchase_price', width: 16, format: '#,##0' }, { header: 'Listed Price', key: 'listed_price', width: 16, format: '#,##0' }, { header: 'Currency', key: 'currency', width: 10 }, { header: 'Status', key: 'status', width: 12 }, { header: 'Arrival Date', key: 'arrival', width: 14 },
    ], rows, { title: 'Vehicle Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length) } });
    toast.success(`${rows.length} vehicle(s) exported`);
  };

  const stockAge = (v: Vehicle): number | null => v.arrival_date ? differenceInCalendarDays(new Date(), new Date(v.arrival_date)) : null;
  const stats = { total: vehicles.length, available: vehicles.filter((v) => v.status === 'in_stock').length, reserved: vehicles.filter((v) => v.status === 'reserved').length, ageing: vehicles.filter((v) => (stockAge(v) || 0) > 90 && v.status === 'in_stock').length };
  const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicle Inventory" description="Manage chassis, stock ageing, pricing, and export readiness" actions={<div className="flex gap-2">{selectedIds.size > 0 && <Button size="sm" variant="outline" onClick={() => setBulkStatusOpen(true)}>Bulk status ({selectedIds.size})</Button>}<Button size="sm" variant="outline" onClick={() => handleExport(false)} disabled={selectedIds.size === 0}><Download className="mr-1.5 h-4 w-4" />Export selected</Button><Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add vehicle</Button></div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total stock', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Available', value: stats.available, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Reserved', value: stats.reserved, tone: 'bg-amber-50 text-amber-600' }, { label: 'Ageing > 90 days', value: stats.ageing, tone: 'bg-red-50 text-red-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock number, chassis, make, model..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={() => handleExport(true)}><Download className="mr-1.5 h-4 w-4" />Export all</Button></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading inventory...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Warehouse className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No vehicles found</h3><p className="mt-1 text-sm text-muted-foreground">Add stock or adjust your search filters.</p><Button size="sm" className="mt-4" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add first vehicle</Button></div> : <div className="divide-y divide-border/70">{filtered.map((v) => <div key={v.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"><Checkbox checked={selectedIds.has(v.id)} onCheckedChange={() => toggleSelect(v.id)} /><button onClick={() => loadHistory(v)} className="flex flex-1 items-center gap-4 text-left"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CarFront className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{v.make} {v.model}</p><Badge variant="outline" className={statusStyles[v.status]}>{statusLabels[v.status]}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{v.stock_number} · {v.chassis_number}{v.model_year ? ` · ${v.model_year}` : ''}</p></div><div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.location || 'Location pending'}</span><span>{stockAge(v) !== null ? `${stockAge(v)} days` : 'Age n/a'}</span>{v.listed_price != null && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatMoney(v.listed_price, v.listed_currency)}</span>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button></div>)}</div>}</Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add vehicle to inventory</DialogTitle></DialogHeader><form onSubmit={submitCreate} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Chassis number *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div><div className="space-y-2"><Label>Source country</Label><Input value={form.source_country} onChange={(e) => setForm({ ...form, source_country: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div><div className="space-y-2"><Label>Grade</Label><Input value={form.model_grade} onChange={(e) => setForm({ ...form, model_grade: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-4"><div className="space-y-2"><Label>Model year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div><div className="space-y-2"><Label>Reg year</Label><Input type="number" value={form.registration_year} onChange={(e) => setForm({ ...form, registration_year: e.target.value })} /></div><div className="space-y-2"><Label>Color</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div><div className="space-y-2"><Label>Mileage km</Label><Input type="number" value={form.mileage_km} onChange={(e) => setForm({ ...form, mileage_km: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Transmission</Label><Select value={form.transmission} onValueChange={(v) => setForm({ ...form, transmission: v as typeof form.transmission })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatic">Automatic</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="cvt">CVT</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Fuel</Label><Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v as typeof form.fuel_type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="petrol">Petrol</SelectItem><SelectItem value="diesel">Diesel</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="electric">Electric</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Purchase price</Label><Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div><div className="space-y-2"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div><div className="space-y-2"><Label>Arrival date</Label><Input type="date" value={form.arrival_date} onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add vehicle'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Edit vehicle</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Chassis number *</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} required /></div><div className="space-y-2"><Label>Source country</Label><Input value={form.source_country} onChange={(e) => setForm({ ...form, source_country: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div><div className="space-y-2"><Label>Grade</Label><Input value={form.model_grade} onChange={(e) => setForm({ ...form, model_grade: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div><div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}><DialogContent><DialogHeader><DialogTitle>Bulk status update</DialogTitle></DialogHeader><div className="space-y-4"><Label>New status</Label><Select value={bulkStatus} onValueChange={(v: Vehicle['status']) => setBulkStatus(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Cancel</Button><Button onClick={applyBulkStatus} disabled={submitting}>{submitting ? 'Updating...' : `Update ${selectedIds.size} vehicles`}</Button></DialogFooter></DialogContent></Dialog>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete vehicle?" description="This permanently removes the vehicle record." onConfirm={confirmDelete} loading={submitting} />

      <Sheet open={Boolean(selected)} onOpenChange={(o) => { if (!o) setSelected(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>{selected ? `${selected.make} ${selected.model}` : 'Vehicle'}</SheetTitle><SheetDescription>{selected?.stock_number} · {selected?.chassis_number}</SheetDescription></SheetHeader>{selected && (<><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-4 w-4" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button></div><div className="mt-6 space-y-4">{detailLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div> : (<><div className="flex flex-wrap gap-2"><Badge variant="outline" className={statusStyles[selected.status]}>{statusLabels[selected.status]}</Badge>{Object.keys(statusLabels).map((s) => <Button key={s} size="sm" variant={selected.status === s ? 'default' : 'outline'} onClick={() => updateStatus(s as Vehicle['status'])}>{statusLabels[s as Vehicle['status']]}</Button>)}</div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Purchase</p><p className="mt-1 text-sm font-semibold">{selected.purchase_price != null ? formatMoney(selected.purchase_price, selected.purchase_currency) : 'Not recorded'}</p></div><div className="rounded-lg bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Listed price</p><p className="mt-1 text-sm font-semibold text-primary">{selected.listed_price != null ? formatMoney(selected.listed_price, selected.listed_currency) : 'Not listed'}</p></div></div>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}<section><div className="mb-3 flex items-center gap-2"><Archive className="h-4 w-4 text-primary" /><h3 className="font-semibold">Status history</h3></div>{history.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No status changes recorded yet.</p> : <div className="space-y-3">{history.map((entry) => <div key={entry.id} className="relative border-l-2 border-border pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-medium">{entry.from_status ? `${statusLabels[entry.from_status]} → ` : ''}{statusLabels[entry.to_status]}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}{entry.note ? ` · ${entry.note}` : ''}</p></div>)}</div>}</section></>)}</div></>)}</SheetContent></Sheet>
    </div>
  );
}
