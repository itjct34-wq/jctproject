'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
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
import type { Vehicle, VehicleStatusHistory } from '@/lib/types';
import { Archive, CarFront, CheckCircle2, ChevronRight, Clock3, DollarSign, Loader2, MapPin, Plus, Search, Tag, Warehouse } from 'lucide-react';
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
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', in_transit: 'In transit', exported: 'Exported', on_hold: 'On hold', archived: 'Archived',
};

const emptyForm = {
  chassis_number: '', make: '', model: '', model_grade: '', model_year: '', registration_year: '', color: '', mileage_km: '', transmission: 'automatic' as NonNullable<Vehicle['transmission']>, fuel_type: 'petrol' as NonNullable<Vehicle['fuel_type']>, source_country: 'Japan', source_supplier: '', purchase_price: '', purchase_currency: 'JPY', listed_price: '', listed_currency: 'JPY', location: '', arrival_date: '', notes: '',
};

export default function VehiclesPage() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [history, setHistory] = useState<VehicleStatusHistory[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('updated_at', { ascending: false });
    if (error) toast.error(`Unable to load inventory: ${error.message}`);
    else setVehicles((data || []) as Vehicle[]);
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setDetailLoading(true);
    const { data, error } = await supabase.from('vehicle_status_history').select('*').eq('vehicle_id', vehicle.id).order('created_at', { ascending: false });
    if (error) toast.error(`Unable to load stock history: ${error.message}`);
    setHistory((data || []) as VehicleStatusHistory[]);
    setDetailLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
      const matchesSearch = !query || [vehicle.stock_number, vehicle.chassis_number, vehicle.make, vehicle.model, vehicle.source_country, vehicle.location]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [vehicles, search, statusFilter]);

  const submitVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !form.chassis_number.trim() || !form.make.trim() || !form.model.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('vehicles').insert({
      chassis_number: form.chassis_number.trim(), make: form.make.trim(), model: form.model.trim(), model_grade: form.model_grade.trim() || null,
      model_year: form.model_year ? Number(form.model_year) : null, registration_year: form.registration_year ? Number(form.registration_year) : null,
      color: form.color.trim() || null, mileage_km: form.mileage_km ? Number(form.mileage_km) : null, transmission: form.transmission, fuel_type: form.fuel_type,
      source_country: form.source_country.trim() || null, source_supplier: form.source_supplier.trim() || null, purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_currency: form.purchase_currency, listed_price: form.listed_price ? Number(form.listed_price) : null, listed_currency: form.listed_currency,
      location: form.location.trim() || null, arrival_date: form.arrival_date || null, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'This chassis number already exists' : `Could not add vehicle: ${error.message}`);
      return;
    }
    toast.success('Vehicle added to inventory');
    setForm(emptyForm);
    setCreateOpen(false);
    await loadVehicles();
    if (data) await loadHistory(data as Vehicle);
  };

  const updateStatus = async (status: Vehicle['status']) => {
    if (!selectedVehicle || !profile || status === selectedVehicle.status) return;
    const previousStatus = selectedVehicle.status;
    const { error } = await supabase.from('vehicles').update({ status, updated_at: new Date().toISOString() }).eq('id', selectedVehicle.id);
    if (error) {
      toast.error(`Could not update vehicle status: ${error.message}`);
      return;
    }
    const { error: historyError } = await supabase.from('vehicle_status_history').insert({ vehicle_id: selectedVehicle.id, from_status: previousStatus, to_status: status, changed_by: profile.id });
    if (historyError) toast.error(`Status saved but history failed: ${historyError.message}`);
    const updated = { ...selectedVehicle, status };
    setSelectedVehicle(updated);
    setVehicles((items) => items.map((item) => item.id === updated.id ? updated : item));
    await loadHistory(updated);
    toast.success('Vehicle status updated');
  };

  const stockAge = (vehicle: Vehicle): number | null => vehicle.arrival_date ? differenceInCalendarDays(new Date(), new Date(vehicle.arrival_date)) : null;
  const stats = {
    total: vehicles.length,
    available: vehicles.filter((vehicle) => vehicle.status === 'in_stock').length,
    reserved: vehicles.filter((vehicle) => vehicle.status === 'reserved').length,
    ageing: vehicles.filter((vehicle) => (stockAge(vehicle) || 0) > 90 && vehicle.status === 'in_stock').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicle Inventory" description="Manage chassis, stock ageing, pricing, and export readiness" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add vehicle</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total stock', value: stats.total, icon: CarFront, tone: 'bg-blue-50 text-blue-600' },
        { label: 'Available', value: stats.available, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Reserved', value: stats.reserved, icon: Tag, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Ageing > 90 days', value: stats.ageing, icon: Clock3, tone: 'bg-red-50 text-red-600' },
      ].map((stat) => <Card key={stat.label} className="border-border/60"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold">{stat.value}</p></div></CardContent></Card>)}</div>

      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stock number, chassis, make, model..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading inventory...</div> : filteredVehicles.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Warehouse className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No vehicles found</h3><p className="mt-1 text-sm text-muted-foreground">Add stock or adjust your search filters.</p></div> : <div className="divide-y divide-border/70">{filteredVehicles.map((vehicle) => <button key={vehicle.id} onClick={() => loadHistory(vehicle)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CarFront className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{vehicle.make} {vehicle.model}</p><Badge variant="outline" className={statusStyles[vehicle.status]}>{statusLabels[vehicle.status]}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{vehicle.stock_number} · {vehicle.chassis_number}{vehicle.model_year ? ` · ${vehicle.model_year}` : ''}</p></div><div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vehicle.location || 'Location pending'}</span><span>{stockAge(vehicle) !== null ? `${stockAge(vehicle)} days` : 'Age n/a'}</span>{vehicle.listed_price && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{vehicle.listed_currency} {vehicle.listed_price.toLocaleString()}</span>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add vehicle to inventory</DialogTitle></DialogHeader><form onSubmit={submitVehicle} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Chassis number *</Label><Input value={form.chassis_number} onChange={(event) => setForm({ ...form, chassis_number: event.target.value })} placeholder="ZVW50-123456" required /></div><div className="space-y-2"><Label>Source country</Label><Input value={form.source_country} onChange={(event) => setForm({ ...form, source_country: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} placeholder="Toyota" required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Prius" required /></div><div className="space-y-2"><Label>Grade</Label><Input value={form.model_grade} onChange={(event) => setForm({ ...form, model_grade: event.target.value })} placeholder="S Touring" /></div></div><div className="grid gap-4 sm:grid-cols-4"><div className="space-y-2"><Label>Model year</Label><Input type="number" value={form.model_year} onChange={(event) => setForm({ ...form, model_year: event.target.value })} /></div><div className="space-y-2"><Label>Mileage km</Label><Input type="number" value={form.mileage_km} onChange={(event) => setForm({ ...form, mileage_km: event.target.value })} /></div><div className="space-y-2"><Label>Color</Label><Input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div><div className="space-y-2"><Label>Fuel</Label><Select value={form.fuel_type} onValueChange={(value: NonNullable<Vehicle['fuel_type']>) => setForm({ ...form, fuel_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="petrol">Petrol</SelectItem><SelectItem value="diesel">Diesel</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="electric">Electric</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Purchase price</Label><Input type="number" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></div><div className="space-y-2"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(event) => setForm({ ...form, listed_price: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Supplier</Label><Input value={form.source_supplier} onChange={(event) => setForm({ ...form, source_supplier: event.target.value })} /></div><div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Nagoya yard" /></div><div className="space-y-2"><Label>Arrival date</Label><Input type="date" value={form.arrival_date} onChange={(event) => setForm({ ...form, arrival_date: event.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.chassis_number.trim() || !form.make.trim() || !form.model.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add vehicle'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Sheet open={Boolean(selectedVehicle)} onOpenChange={(open) => !open && setSelectedVehicle(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><>{selectedVehicle && <><SheetHeader className="pr-8"><div className="flex items-start justify-between gap-3"><div><SheetTitle>{selectedVehicle.make} {selectedVehicle.model}</SheetTitle><SheetDescription>{selectedVehicle.stock_number} · {selectedVehicle.chassis_number}</SheetDescription></div><Select value={selectedVehicle.status} onValueChange={(value: Vehicle['status']) => updateStatus(value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></SheetHeader>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading history...</div> : <div className="space-y-6 pt-6"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Specification</p><p className="mt-1 text-sm font-medium">{selectedVehicle.model_year || 'Year n/a'} · {selectedVehicle.color || 'Color n/a'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedVehicle.mileage_km?.toLocaleString() || 'Mileage n/a'} km · {selectedVehicle.fuel_type || 'Fuel n/a'}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Stock ageing</p><p className="mt-1 text-sm font-medium">{stockAge(selectedVehicle) !== null ? `${stockAge(selectedVehicle)} days` : 'Not available'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedVehicle.arrival_date ? `Arrived ${format(new Date(selectedVehicle.arrival_date), 'MMM d, yyyy')}` : 'Arrival date not recorded'}</p></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Purchase</p><p className="mt-1 text-sm font-semibold">{selectedVehicle.purchase_price ? `${selectedVehicle.purchase_currency} ${selectedVehicle.purchase_price.toLocaleString()}` : 'Not recorded'}</p></div><div className="rounded-lg bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Listed price</p><p className="mt-1 text-sm font-semibold text-primary">{selectedVehicle.listed_price ? `${selectedVehicle.listed_currency} ${selectedVehicle.listed_price.toLocaleString()}` : 'Not listed'}</p></div></div>{selectedVehicle.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selectedVehicle.notes}</p>}<section><div className="mb-3 flex items-center gap-2"><Archive className="h-4 w-4 text-primary" /><div><h3 className="font-semibold">Status history</h3><p className="text-xs text-muted-foreground">Operational changes for this stock record</p></div></div>{history.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No status changes recorded yet.</p> : <div className="space-y-3">{history.map((entry) => <div key={entry.id} className="relative border-l-2 border-border pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-medium">{entry.from_status ? `${statusLabels[entry.from_status]} → ` : ''}{statusLabels[entry.to_status]}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}{entry.note ? ` · ${entry.note}` : ''}</p></div>)}</div>}</section></div>}</>}</></SheetContent></Sheet>
    </div>
  );
}
