'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
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
import { type GalleryImage } from '@/components/shared/multi-image-upload';
import { loadVehicleImages, saveVehicleImages } from '@/lib/utils/vehicle-images';
import { VehiclesBulkImportButton } from '@/components/vehicles/vehicles-bulk-import-button';
import { mapTransmissionToDb, VehicleSpecFields } from '@/components/vehicles/vehicle-spec-fields';
import { SOURCE_COUNTRIES, resolveSourceCountry } from '@/lib/source-countries';
import { parseStockCategory, stockCategoryLabel, type StockCategory } from '@/lib/stock-category';
import { nextVehicleStockNumber } from '@/lib/utils/stock-number';
import { mergeEngineIntoNotes, publicEngineFromNotes, stripEngineFromNotes } from '@/lib/public/vehicles';
import type { Customer, Vehicle } from '@/lib/types';
import {
  effectivePaymentStatus,
  effectiveShippingStatus,
  emptyShippingForm,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUS_STYLES,
  type VehicleShippingStatus,
} from '@/lib/vehicle-lifecycle';
import { AttachmentCountBadge, RecordAttachments, useAttachmentCounts } from '@/components/shared/record-attachments';
import { CarFront, ChevronRight, Loader2, MapPin, Pencil, Plus, Search, Ship, Tag, Trash2 } from 'lucide-react';
import { CurrencySelect } from '@/components/ui/currency-select';
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
  stock_category: 'car' as StockCategory,
  chassis_number: '', stock_number: '', part_sku: '', make: '', model: '', colour: '', model_year: '',
  engine: '', transmission: '', listed_price: '', listed_currency: 'USD',
  notes: '', primary_image_url: '', source_country_code: 'JP',
};

const LIST_TITLES: Record<StockCategory, { title: string; description: string }> = {
  car: { title: 'Cars', description: 'Passenger cars · photos · FOB pricing' },
  machinery: { title: 'Machinery', description: 'Plant and equipment · photos · FOB pricing' },
  parts: { title: 'Parts', description: 'Spares and components · photos · FOB pricing' },
};

function VehiclesPage() {
  const searchParams = useSearchParams();
  const listCategory: StockCategory =
    searchParams.get('category') === 'machinery' || searchParams.get('category') === 'parts'
      ? (searchParams.get('category') as StockCategory)
      : 'car';
  const listCopy = LIST_TITLES[listCategory];
  const { profile } = useAuth();
  const { can, hasRole } = usePermissions();
  const canCreateVehicle = can('vehicles', 'create');
  const canEditVehicle = can('vehicles', 'edit');
  const canDeleteVehicle = can('vehicles', 'delete');
  const canReserveStock =
    (hasRole('sales_agent') || hasRole('freelancer')) && !canEditVehicle;
  const canEditShipping = canEditVehicle;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'full_name' | 'customer_code'>[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<Vehicle['status']>('in_stock');
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveCustomerId, setReserveCustomerId] = useState('');
  const [reserveDays, setReserveDays] = useState('7');
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState(emptyShippingForm);
  const vehicleIds = useMemo(() => vehicles.map((v) => v.id), [vehicles]);
  const { counts: courierDocCounts } = useAttachmentCounts('vehicles', vehicleIds);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const [vRes, cRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('updated_at', { ascending: false }),
      supabase.from('customers').select('id, full_name, customer_code').order('full_name'),
    ]);
    if (vRes.error) toast.error(`Unable to load inventory: ${vRes.error.message}`);
    else setVehicles((vRes.data || []) as Vehicle[]);
    if (cRes.data) setCustomers(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesCategory = parseStockCategory(v.stock_category) === listCategory;
      const matchesSearch = !q || [v.stock_number, v.chassis_number, v.part_sku, v.make, v.model].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [vehicles, search, statusFilter, listCategory]);

  const openCreate = () => {
    const defaultCategory: StockCategory = listCategory;
    setForm({
      ...emptyForm,
      stock_category: defaultCategory,
      stock_number: nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
    });
    setGallery([]);
    setCreateOpen(true);
  };

  const openEdit = async () => {
    if (!selected) return;
    const imgs = await loadVehicleImages(selected.id);
    setGallery(imgs.length ? imgs : (selected.primary_image_url ? [{ image_url: selected.primary_image_url, sort_order: 0, is_primary: true }] : []));
    setForm({
      stock_category: parseStockCategory(selected.stock_category),
      chassis_number: selected.chassis_number,
      stock_number: selected.stock_number || '',
      part_sku: selected.part_sku || '',
      make: selected.make,
      model: selected.model,
      colour: selected.color || '',
      model_year: selected.model_year ? String(selected.model_year) : '',
      engine: publicEngineFromNotes(selected.notes) || '',
      transmission: selected.transmission || '',
      listed_price: selected.listed_price ? String(selected.listed_price) : '',
      listed_currency: selected.listed_currency || 'USD',
      notes: stripEngineFromNotes(selected.notes),
      primary_image_url: selected.primary_image_url || '',
      source_country_code: selected.source_country_code || resolveSourceCountry(selected.source_country)?.code || 'JP',
    });
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateVehicle) {
      toast.error('You do not have permission to add stock');
      return;
    }
    const category = parseStockCategory(form.stock_category);
    const chassis = form.chassis_number.trim() || (category === 'parts' ? (form.part_sku.trim() || form.stock_number.trim()) : '');
    if (!profile || !chassis || !form.make.trim() || !form.model.trim()) {
      toast.error(category === 'parts' ? 'Part number, stock no., or chassis is required' : 'Chassis, make, and model are required');
      return;
    }
    setSubmitting(true);
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const origin = resolveSourceCountry(form.source_country_code);
    const insertPayload: Record<string, unknown> = {
      chassis_number: chassis,
      stock_category: category,
      part_sku: form.part_sku.trim() || (category === 'parts' ? chassis : null),
      make: form.make.trim(),
      model: form.model.trim(),
      color: form.colour.trim() || null,
      model_year: form.model_year ? Number(form.model_year) : null,
      transmission: mapTransmissionToDb(form.transmission),
      listed_price: form.listed_price ? Number(form.listed_price) : null,
      listed_currency: form.listed_currency,
      notes: mergeEngineIntoNotes(form.notes, form.engine),
      primary_image_url: primary,
      source_country: origin?.name || 'Japan',
      source_country_code: origin?.code || 'JP',
      created_by: profile.id,
      stock_number: form.stock_number.trim() || nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
    };
    let { data, error } = await supabase.from('vehicles').insert(insertPayload).select().maybeSingle();
    if (error && /source_country_code|stock_category|part_sku/i.test(error.message)) {
      const { source_country_code: _c, stock_category: _sc, part_sku: _sku, ...rest } = insertPayload;
      void _c; void _sc; void _sku;
      ({ data, error } = await supabase.from('vehicles').insert(rest).select().maybeSingle());
    }
    if (error) { setSubmitting(false); toast.error(error.message); return; }
    if (data && gallery.length) {
      try { await saveVehicleImages((data as Vehicle).id, gallery); } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Photos save failed');
      }
    }
    setSubmitting(false);
    toast.success('Stock added');
    setCreateOpen(false);
    setGallery([]);
    await loadVehicles();
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!canEditVehicle) {
      toast.error('You do not have permission to edit stock');
      return;
    }
    setSubmitting(true);
    try {
      await saveVehicleImages(selected.id, gallery);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Photos save failed');
    }
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const category = parseStockCategory(form.stock_category);
    const chassis = form.chassis_number.trim() || (category === 'parts' ? (form.part_sku.trim() || form.stock_number.trim()) : '');
    if (!chassis || !form.make.trim() || !form.model.trim()) {
      setSubmitting(false);
      toast.error(category === 'parts' ? 'Part number, stock no., or chassis is required' : 'Chassis, make, and model are required');
      return;
    }
    const origin = resolveSourceCountry(form.source_country_code);
    const updatePayload: Record<string, unknown> = {
      chassis_number: chassis,
      stock_category: category,
      part_sku: form.part_sku.trim() || (category === 'parts' ? chassis : null),
      make: form.make.trim(),
      model: form.model.trim(),
      color: form.colour.trim() || null,
      model_year: form.model_year ? Number(form.model_year) : null,
      transmission: mapTransmissionToDb(form.transmission),
      listed_price: form.listed_price ? Number(form.listed_price) : null,
      listed_currency: form.listed_currency,
      notes: mergeEngineIntoNotes(form.notes, form.engine),
      primary_image_url: primary,
      source_country: origin?.name || selected.source_country,
      source_country_code: origin?.code || selected.source_country_code,
      updated_at: new Date().toISOString(),
    };
    if (form.stock_number.trim()) updatePayload.stock_number = form.stock_number.trim();
    else updatePayload.stock_number = selected.stock_number;
    let { error } = await supabase.from('vehicles').update(updatePayload).eq('id', selected.id);
    if (error && /source_country_code|stock_category|part_sku/i.test(error.message)) {
      const { source_country_code: _c, stock_category: _sc, part_sku: _sku, ...rest } = updatePayload;
      void _c; void _sc; void _sku;
      ({ error } = await supabase.from('vehicles').update(rest).eq('id', selected.id));
    }
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Stock updated');
    setEditOpen(false);
    await loadVehicles();
  };

  const confirmDelete = async () => {
    if (!selected) return;
    if (!canDeleteVehicle) {
      toast.error('You do not have permission to delete stock');
      return;
    }
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

  const customerLabel = (id: string | null) =>
    id ? customers.find((c) => c.id === id)?.full_name || 'Customer' : '';

  const openReserve = () => {
    if (!selected) return;
    setReserveCustomerId('');
    setReserveDays('7');
    setReserveOpen(true);
  };

  const submitReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selected || !reserveCustomerId) return;
    const days = Math.max(1, Number(reserveDays) || 7);
    const reservedUntil = new Date();
    reservedUntil.setDate(reservedUntil.getDate() + days);
    const reservedUntilStr = reservedUntil.toISOString().slice(0, 10);
    setSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .update({
        payment_status: 'reserved',
        customer_id: reserveCustomerId,
        reserved_by: profile.id,
        reserved_until: reservedUntilStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    await supabase.from('vehicle_status_history').insert({
      vehicle_id: selected.id,
      from_status: selected.status,
      to_status: 'reserved',
      note: `Reserved for ${customerLabel(reserveCustomerId)} until ${reservedUntilStr}`,
      changed_by: profile.id,
    });
    setSubmitting(false);
    toast.success(`Reserved for ${customerLabel(reserveCustomerId)}`);
    setReserveOpen(false);
    await loadVehicles();
  };

  const openShippingEdit = () => {
    if (!selected) return;
    setShippingForm({
      shipping_status: effectiveShippingStatus(selected),
      shipping_port_of_loading: selected.shipping_port_of_loading || '',
      shipping_port_of_discharge: selected.shipping_port_of_discharge || '',
      shipping_vessel_name: selected.shipping_vessel_name || '',
      shipping_bl_number: selected.shipping_bl_number || '',
      shipping_line: selected.shipping_line || '',
      shipping_etd: selected.shipping_etd || '',
      shipping_eta: selected.shipping_eta || '',
      shipping_notes: selected.shipping_notes || '',
    });
    setShippingOpen(true);
  };

  const submitShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !canEditShipping) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .update({
        shipping_status: shippingForm.shipping_status,
        shipping_port_of_loading: shippingForm.shipping_port_of_loading.trim() || null,
        shipping_port_of_discharge: shippingForm.shipping_port_of_discharge.trim() || null,
        shipping_vessel_name: shippingForm.shipping_vessel_name.trim() || null,
        shipping_bl_number: shippingForm.shipping_bl_number.trim() || null,
        shipping_line: shippingForm.shipping_line.trim() || null,
        shipping_etd: shippingForm.shipping_etd || null,
        shipping_eta: shippingForm.shipping_eta || null,
        shipping_notes: shippingForm.shipping_notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Shipping updated');
    setShippingOpen(false);
    await loadVehicles();
  };

  const catalogVehicles = useMemo(
    () => vehicles.filter((v) => parseStockCategory(v.stock_category) === listCategory),
    [vehicles, listCategory]
  );
  const stats = {
    total: catalogVehicles.length,
    available: catalogVehicles.filter((v) => effectivePaymentStatus(v) === 'available').length,
    reserved: catalogVehicles.filter((v) => effectivePaymentStatus(v) === 'reserved').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={listCopy.title} description={listCopy.description}
        actions={canCreateVehicle || canEditVehicle ? (
          <div className="flex flex-wrap gap-2">
            {canEditVehicle && selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkStatusOpen(true)}>Bulk status ({selectedIds.size})</Button>
            )}
            {canCreateVehicle && <VehiclesBulkImportButton kind={listCategory} />}
            {canCreateVehicle && (
              <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add stock</Button>
            )}
          </div>
        ) : undefined} />

      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Total', v: stats.total }, { l: 'Available', v: stats.available }, { l: 'Reserved', v: stats.reserved }].map((s) => (
          <Card key={s.l} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <Card className="border-border/60"><CardContent className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      </CardContent></Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? <div className="p-14 flex justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
          : filtered.length === 0 ? <div className="p-14 text-center text-muted-foreground">No {listCopy.title.toLowerCase()} in this list yet. Use Bulk upload to import a sheet.</div>
          : <div className="divide-y">{filtered.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-4 hover:bg-muted/40">
              {canEditVehicle && (
                <Checkbox checked={selectedIds.has(v.id)} onCheckedChange={() => setSelectedIds((prev) => { const n = new Set(prev); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })} />
              )}
              <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => setSelected(v)}>
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
                  {v.primary_image_url ? <img src={v.primary_image_url} alt="" className="h-full w-full object-cover" /> : <CarFront className="h-5 w-5 text-primary" />}
                </div>
                <div className="min-w-0 flex-1"><p className="font-medium">{v.make} {v.model}</p><p className="text-xs text-muted-foreground">{stockCategoryLabel(parseStockCategory(v.stock_category))} · {v.stock_number} · {v.chassis_number}{v.part_sku ? ` · ${v.part_sku}` : ''}{v.source_country ? ` · ${v.source_country}` : ''}{v.source_country_code ? ` (${v.source_country_code})` : ''}</p></div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={PAYMENT_STATUS_STYLES[effectivePaymentStatus(v)]}>
                    {PAYMENT_STATUS_LABELS[effectivePaymentStatus(v)]}
                  </Badge>
                  <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(v)]}>
                    {SHIPPING_STATUS_LABELS[effectiveShippingStatus(v)]}
                  </Badge>
                  <AttachmentCountBadge count={courierDocCounts[v.id] || 0} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}</div>}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent fullscreen>
        <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
        <form onSubmit={submitCreate} className="space-y-3">
          <VehicleSpecFields form={form} onChange={(patch) => setForm({ ...form, ...patch })} gallery={gallery} onGalleryChange={setGallery} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div>
            <div className="space-y-1"><Label>Currency</Label><CurrencySelect value={form.listed_currency} onValueChange={(v) => setForm({ ...form, listed_currency: v })} /></div></div>
          <div className="space-y-1"><Label>Source country *</Label>
            <Select value={form.source_country_code} onValueChange={(v) => setForm({ ...form, source_country_code: v })}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {SOURCE_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent fullscreen>
        <DialogHeader><DialogTitle>Edit stock</DialogTitle></DialogHeader>
        <form onSubmit={submitEdit} className="space-y-3">
          <VehicleSpecFields form={form} onChange={(patch) => setForm({ ...form, ...patch })} gallery={gallery} onGalleryChange={setGallery} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Listed price</Label><Input type="number" value={form.listed_price} onChange={(e) => setForm({ ...form, listed_price: e.target.value })} /></div>
            <div className="space-y-1"><Label>Currency</Label><CurrencySelect value={form.listed_currency} onValueChange={(v) => setForm({ ...form, listed_currency: v })} /></div></div>
          <div className="space-y-1"><Label>Source country *</Label>
            <Select value={form.source_country_code} onValueChange={(v) => setForm({ ...form, source_country_code: v })}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {SOURCE_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Sheet open={!!selected && !editOpen && !deleteOpen && !reserveOpen && !shippingOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">{selected && (<>
          <SheetHeader><SheetTitle>{selected.make} {selected.model}</SheetTitle><SheetDescription>{selected.stock_number} · {statusLabels[selected.status]}</SheetDescription></SheetHeader>
          {selected.primary_image_url && <img src={selected.primary_image_url} alt="" className="mt-4 rounded-lg w-full max-h-48 object-cover" />}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className={PAYMENT_STATUS_STYLES[effectivePaymentStatus(selected)]}>{PAYMENT_STATUS_LABELS[effectivePaymentStatus(selected)]}</Badge>
            <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(selected)]}>{SHIPPING_STATUS_LABELS[effectiveShippingStatus(selected)]}</Badge>
          </div>
          {selected.customer_id && (
            <p className="mt-2 text-sm text-muted-foreground">Buyer: {customerLabel(selected.customer_id)}</p>
          )}
          {selected.reserved_until && (
            <p className="text-xs text-muted-foreground">Reserved until {selected.reserved_until}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {canReserveStock && effectivePaymentStatus(selected) === 'available' && (
              <Button size="sm" onClick={openReserve}><Tag className="h-3.5 w-3.5 mr-1" />Reserve</Button>
            )}
            {canEditVehicle && (
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit stock</Button>
            )}
            {canEditShipping && (
              <Button size="sm" variant="outline" onClick={openShippingEdit}><Ship className="h-3.5 w-3.5 mr-1" />Shipping</Button>
            )}
            {canDeleteVehicle && (
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            )}
          </div>
          <RecordAttachments
            entityType="vehicles"
            entityId={selected.id}
            allowUpload={canEditShipping}
          />
        </>)}</SheetContent>
      </Sheet>

      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}><DialogContent>
        <DialogHeader><DialogTitle>Reserve vehicle</DialogTitle></DialogHeader>
        <form onSubmit={submitReserve} className="space-y-3">
          <div className="space-y-1"><Label>Customer *</Label>
            <Select value={reserveCustomerId} onValueChange={setReserveCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select your customer" /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Hold (days)</Label><Input type="number" min={1} value={reserveDays} onChange={(e) => setReserveDays(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={submitting || !reserveCustomerId}>Confirm reserve</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={shippingOpen} onOpenChange={setShippingOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Shipping &amp; export</DialogTitle></DialogHeader>
        <form onSubmit={submitShipping} className="space-y-3">
          <div className="space-y-1"><Label>Shipping status</Label>
            <Select value={shippingForm.shipping_status} onValueChange={(v: VehicleShippingStatus) => setShippingForm({ ...shippingForm, shipping_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SHIPPING_STATUS_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>POL</Label><Input value={shippingForm.shipping_port_of_loading} onChange={(e) => setShippingForm({ ...shippingForm, shipping_port_of_loading: e.target.value })} /></div>
            <div className="space-y-1"><Label>POD</Label><Input value={shippingForm.shipping_port_of_discharge} onChange={(e) => setShippingForm({ ...shippingForm, shipping_port_of_discharge: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Vessel</Label><Input value={shippingForm.shipping_vessel_name} onChange={(e) => setShippingForm({ ...shippingForm, shipping_vessel_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>B/L number</Label><Input value={shippingForm.shipping_bl_number} onChange={(e) => setShippingForm({ ...shippingForm, shipping_bl_number: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Shipping line</Label><Input value={shippingForm.shipping_line} onChange={(e) => setShippingForm({ ...shippingForm, shipping_line: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>ETD</Label><Input type="date" value={shippingForm.shipping_etd} onChange={(e) => setShippingForm({ ...shippingForm, shipping_etd: e.target.value })} /></div>
            <div className="space-y-1"><Label>ETA</Label><Input type="date" value={shippingForm.shipping_eta} onChange={(e) => setShippingForm({ ...shippingForm, shipping_eta: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={shippingForm.shipping_notes} onChange={(e) => setShippingForm({ ...shippingForm, shipping_notes: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={submitting}>Save shipping</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

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

export default function VehiclesPageRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      }
    >
      <VehiclesPage />
    </Suspense>
  );
}
