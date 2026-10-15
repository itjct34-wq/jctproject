'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { formatMoney } from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { type GalleryImage, MultiImageUpload } from '@/components/shared/multi-image-upload';
import { loadVehicleImages, saveVehicleImages } from '@/lib/utils/vehicle-images';
import { mapTransmissionToDb, VehicleSpecFields } from '@/components/vehicles/vehicle-spec-fields';
import { FobFormulaFields } from '@/components/vehicles/fob-formula-fields';
import { ShippingStepper } from '@/components/vehicles/shipping-stepper';
import { VehicleShippingDocs } from '@/components/vehicles/vehicle-shipping-docs';
import { SOURCE_COUNTRIES, resolveSourceCountry } from '@/lib/source-countries';
import { parseStockCategory, stockCategoryLabel, type StockCategory } from '@/lib/stock-category';
import { nextVehicleStockNumber } from '@/lib/utils/stock-number';
import { mergeEngineIntoNotes, publicEngineFromNotes, stripEngineFromNotes } from '@/lib/public/vehicles';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';
import type { Customer, Payment, Vehicle } from '@/lib/types';
import {
  effectivePaymentStatus,
  effectiveShippingStatus,
  emptyShippingForm,
  INCOTERMS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  PAYMENT_STATUSES,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUS_STYLES,
  SHIPPING_STATUSES,
  WORKFLOW_STAGE_LABELS,
  workflowStage,
  type VehicleIncoterm,
  type VehiclePaymentStatus,
  type VehicleShippingStatus,
} from '@/lib/vehicle-lifecycle';
import { CarFront, ChevronRight, Loader2, Pencil, Plus, Search, Ship, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusLabels: Record<Vehicle['status'], string> = {
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', in_transit: 'In transit',
  exported: 'Exported', on_hold: 'On hold', archived: 'Archived',
};

const emptyForm = {
  stock_category: 'car' as StockCategory,
  chassis_number: '', stock_number: '', part_sku: '', make: '', model: '', colour: '', model_year: '',
  engine: '', transmission: '',
  purchase_price: '', expense_jpy: String(FIXED_EXPENSE_JPY), tt_rate: String(DEFAULT_TT_RATE),
  notes: '', primary_image_url: '', source_country_code: 'JP',
  customer_id: '', sold_price: '', incoterm: 'FOB' as VehicleIncoterm, reserved_until: '',
  payment_status: 'available' as VehiclePaymentStatus,
  shipping_status: 'not_booked' as VehicleShippingStatus,
  status: 'in_stock' as Vehicle['status'],
  ...emptyShippingForm,
};

const LIST_TITLES: Record<StockCategory, { title: string; description: string }> = {
  car: { title: 'Cars', description: 'FOB, reservation, payment, and shipping stage' },
  machinery: { title: 'Machinery', description: 'FOB, reservation, payment, and shipping stage' },
  parts: { title: 'Parts', description: 'FOB, reservation, payment, and shipping stage' },
};

function fobFromForm(form: typeof emptyForm) {
  if (!form.purchase_price) return null;
  return calcFobFromBid(
    Number(form.purchase_price) || 0,
    form.expense_jpy === '' ? FIXED_EXPENSE_JPY : Number(form.expense_jpy) || 0,
    form.tt_rate === '' ? DEFAULT_TT_RATE : Number(form.tt_rate) || DEFAULT_TT_RATE
  );
}

function VehiclesPage() {
  const searchParams = useSearchParams();
  const listCategory: StockCategory =
    searchParams.get('category') === 'machinery' || searchParams.get('category') === 'parts'
      ? (searchParams.get('category') as StockCategory)
      : 'car';
  const listCopy = LIST_TITLES[listCategory];
  const { profile } = useAuth();
  const { can, hasRole, isSellingFocused } = usePermissions();
  const canCreateVehicle = can('vehicles', 'create');
  const canEditVehicle = can('vehicles', 'edit');
  const canDeleteVehicle = can('vehicles', 'delete');
  const canReserveStock =
    (hasRole('sales_agent') || hasRole('freelancer')) && !canEditVehicle;
  const canEditShipping = canEditVehicle;
  const canRecordPayment = can('payments', 'create');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'full_name' | 'customer_code'>[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [vehiclePayments, setVehiclePayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveCustomerId, setReserveCustomerId] = useState('');
  const [reserveDays, setReserveDays] = useState('7');
  const [reserveSoldPrice, setReserveSoldPrice] = useState('');
  const [reserveIncoterm, setReserveIncoterm] = useState<VehicleIncoterm>('FOB');
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState(emptyShippingForm);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    await supabase.rpc('expire_reserved_vehicles');
    const [vRes, cRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('updated_at', { ascending: false }).limit(250),
      supabase.from('customers').select('id, full_name, customer_code').order('full_name').limit(250),
    ]);
    if (vRes.error) toast.error(`Unable to load inventory: ${vRes.error.message}`);
    else setVehicles((vRes.data || []) as Vehicle[]);
    if (cRes.data) setCustomers(cRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const loadVehiclePayments = useCallback(async (vehicleId: string) => {
    const { data } = await supabase.from('payments').select('*').eq('vehicle_id', vehicleId).order('payment_date', { ascending: false });
    setVehiclePayments((data || []) as Payment[]);
  }, []);

  useEffect(() => {
    if (selected?.id) void loadVehiclePayments(selected.id);
    else setVehiclePayments([]);
  }, [selected?.id, loadVehiclePayments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesStatus = statusFilter === 'all' || workflowStage(v) === statusFilter || v.status === statusFilter;
      const matchesCategory = parseStockCategory(v.stock_category) === listCategory;
      const matchesSearch = !q || [v.stock_number, v.chassis_number, v.part_sku, v.make, v.model].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [vehicles, search, statusFilter, listCategory]);

  const fillFormFromVehicle = (v: Vehicle) => {
    setForm({
      stock_category: parseStockCategory(v.stock_category),
      chassis_number: v.chassis_number,
      stock_number: v.stock_number || '',
      part_sku: v.part_sku || '',
      make: v.make,
      model: v.model,
      colour: v.color || '',
      model_year: v.model_year ? String(v.model_year) : '',
      engine: publicEngineFromNotes(v.notes) || '',
      transmission: v.transmission || '',
      purchase_price: v.purchase_price != null ? String(v.purchase_price) : '',
      expense_jpy: v.expense_jpy != null ? String(v.expense_jpy) : String(FIXED_EXPENSE_JPY),
      tt_rate: v.tt_rate != null ? String(v.tt_rate) : String(DEFAULT_TT_RATE),
      notes: stripEngineFromNotes(v.notes),
      primary_image_url: v.primary_image_url || '',
      source_country_code: v.source_country_code || resolveSourceCountry(v.source_country)?.code || 'JP',
      customer_id: v.customer_id || '',
      payment_status: effectivePaymentStatus(v),
      shipping_status: effectiveShippingStatus(v),
      status: v.status,
      sold_price: v.sold_price != null ? String(v.sold_price) : '',
      incoterm: (v.incoterm as VehicleIncoterm) || 'FOB',
      reserved_until: v.reserved_until || '',
      shipping_port_of_loading: v.shipping_port_of_loading || '',
      shipping_port_of_discharge: v.shipping_port_of_discharge || '',
      shipping_vessel_name: v.shipping_vessel_name || '',
      shipping_bl_number: v.shipping_bl_number || '',
      shipping_line: v.shipping_line || '',
      shipping_etd: v.shipping_etd || '',
      shipping_eta: v.shipping_eta || '',
      shipping_notes: v.shipping_notes || '',
    });
  };

  const openCreate = () => {
    setForm({
      ...emptyForm,
      stock_category: listCategory,
      stock_number: nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
    });
    setGallery([]);
    setCreateOpen(true);
  };

  const openEdit = async () => {
    if (!selected) return;
    const imgs = await loadVehicleImages(selected.id);
    setGallery(imgs.length ? imgs : (selected.primary_image_url ? [{ image_url: selected.primary_image_url, sort_order: 0, is_primary: true }] : []));
    fillFormFromVehicle(selected);
    setEditOpen(true);
  };

  const stockPayload = (formState: typeof emptyForm) => {
    const category = parseStockCategory(formState.stock_category);
    const chassis = formState.chassis_number.trim() || (category === 'parts' ? (formState.part_sku.trim() || formState.stock_number.trim()) : '');
    const origin = resolveSourceCountry(formState.source_country_code);
    const fob = fobFromForm(formState);
    const payload: Record<string, unknown> = {
      chassis_number: chassis,
      stock_category: category,
      part_sku: formState.part_sku.trim() || (category === 'parts' ? chassis : null),
      make: formState.make.trim(),
      model: formState.model.trim(),
      color: formState.colour.trim() || null,
      model_year: formState.model_year ? Number(formState.model_year) : null,
      transmission: mapTransmissionToDb(formState.transmission),
      purchase_price: formState.purchase_price ? Number(formState.purchase_price) : null,
      expense_jpy: formState.expense_jpy === '' ? FIXED_EXPENSE_JPY : Number(formState.expense_jpy) || 0,
      tt_rate: formState.tt_rate === '' ? DEFAULT_TT_RATE : Number(formState.tt_rate) || DEFAULT_TT_RATE,
      fob_usd: fob ? Number(fob.fobUsd.toFixed(2)) : null,
      listed_price: fob ? Number(fob.fobUsd.toFixed(2)) : null,
      listed_currency: 'USD',
      notes: mergeEngineIntoNotes(formState.notes, formState.engine),
      source_country: origin?.name || 'Japan',
      source_country_code: origin?.code || 'JP',
    };
    return { chassis, category, payload };
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateVehicle) {
      toast.error('You do not have permission to add stock');
      return;
    }
    const { chassis, category, payload } = stockPayload(form);
    if (!profile || !chassis || !form.make.trim() || !form.model.trim()) {
      toast.error(category === 'parts' ? 'Part number, stock no., or chassis is required' : 'Chassis, make, and model are required');
      return;
    }
    setSubmitting(true);
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const insertPayload: Record<string, unknown> = {
      ...payload,
      primary_image_url: primary,
      created_by: profile.id,
      stock_number: form.stock_number.trim() || nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
      payment_status: form.payment_status,
      shipping_status: form.shipping_status,
      ...(form.status === 'on_hold' || form.status === 'archived' ? { status: form.status } : {}),
    };
    let { data, error } = await supabase.from('vehicles').insert(insertPayload).select().maybeSingle();
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd/i.test(error.message)) {
      const rest = { ...insertPayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.tt_rate;
      delete rest.fob_usd;
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
    const { chassis, category, payload } = stockPayload(form);
    if (!chassis || !form.make.trim() || !form.model.trim()) {
      setSubmitting(false);
      toast.error(category === 'parts' ? 'Part number, stock no., or chassis is required' : 'Chassis, make, and model are required');
      return;
    }
    const primary = gallery.find((g) => g.is_primary)?.image_url || gallery[0]?.image_url || null;
    const reserving = Boolean(form.customer_id);
    const updatePayload: Record<string, unknown> = {
      ...payload,
      primary_image_url: primary,
      stock_number: form.stock_number.trim() || selected.stock_number,
      customer_id: form.customer_id || null,
      sold_price: form.sold_price ? Number(form.sold_price) : null,
      incoterm: form.customer_id ? form.incoterm : selected.incoterm || null,
      reserved_until: form.reserved_until || null,
      payment_status: form.payment_status,
      shipping_status: form.shipping_status,
      shipping_port_of_loading: form.shipping_port_of_loading.trim() || null,
      shipping_port_of_discharge: form.shipping_port_of_discharge.trim() || null,
      shipping_vessel_name: form.shipping_vessel_name.trim() || null,
      shipping_bl_number: form.shipping_bl_number.trim() || null,
      shipping_line: form.shipping_line.trim() || null,
      shipping_etd: form.shipping_etd || null,
      shipping_eta: form.shipping_eta || null,
      shipping_notes: form.shipping_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (form.status === 'on_hold' || form.status === 'archived') {
      updatePayload.status = form.status;
    }
    if (reserving && form.payment_status === 'available') {
      updatePayload.payment_status = 'reserved';
      updatePayload.reserved_by = profile?.id || selected.reserved_by;
    } else if (reserving && !selected.reserved_by) {
      updatePayload.reserved_by = profile?.id || selected.reserved_by;
    }
    let { error } = await supabase.from('vehicles').update(updatePayload).eq('id', selected.id);
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd|sold_price|incoterm/i.test(error.message)) {
      const rest = { ...updatePayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.tt_rate;
      delete rest.fob_usd;
      delete rest.sold_price;
      delete rest.incoterm;
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
    if (effectivePaymentStatus(selected) !== 'available' || selected.customer_id) {
      toast.error('Reserved or invoiced stock cannot be deleted');
      return;
    }
    const { data: invoiceHit } = await supabase.from('invoice_items').select('id').eq('vehicle_id', selected.id).limit(1);
    if (invoiceHit && invoiceHit.length > 0) {
      toast.error('Reserved or invoiced stock cannot be deleted');
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

  const customerLabel = (id: string | null) =>
    id ? customers.find((c) => c.id === id)?.full_name || 'Customer' : '';

  const openReserve = () => {
    if (!selected) return;
    setReserveCustomerId(selected.customer_id || '');
    setReserveDays('7');
    setReserveSoldPrice(selected.sold_price != null ? String(selected.sold_price) : (selected.fob_usd != null ? String(selected.fob_usd) : selected.listed_price != null ? String(selected.listed_price) : ''));
    setReserveIncoterm((selected.incoterm as VehicleIncoterm) || 'FOB');
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
        sold_price: reserveSoldPrice ? Number(reserveSoldPrice) : null,
        incoterm: reserveIncoterm,
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
      note: `Reserved for ${customerLabel(reserveCustomerId)} · ${reserveIncoterm} · until ${reservedUntilStr}`,
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
    toast.success('Booking saved');
    setShippingOpen(false);
    await loadVehicles();
  };

  const submitVehiclePayment = async () => {
    if (!profile || !selected || !canRecordPayment) return;
    const amount = Number(payAmount) || 0;
    if (amount <= 0) { toast.error('Enter a payment amount'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('payments').insert({
      customer_id: selected.customer_id || null,
      vehicle_id: selected.id,
      payment_date: payDate || new Date().toISOString().split('T')[0],
      amount,
      currency: 'USD',
      exchange_rate: 1,
      amount_jpy: amount,
      payment_method: 'bank_transfer',
      status: 'received',
      created_by: profile.id,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment allocated');
    setPayAmount('');
    await loadVehiclePayments(selected.id);
    await loadVehicles();
  };

  const catalogVehicles = useMemo(
    () => vehicles.filter((v) => parseStockCategory(v.stock_category) === listCategory),
    [vehicles, listCategory]
  );
  const stats = {
    total: catalogVehicles.length,
    available: catalogVehicles.filter((v) => effectivePaymentStatus(v) === 'available').length,
    reserved: catalogVehicles.filter((v) => effectivePaymentStatus(v) !== 'available').length,
  };

  const fobLabel = (v: Vehicle) => {
    const n = v.fob_usd ?? v.listed_price;
    return n != null ? formatMoney(Number(n), v.listed_currency || 'USD') : '—';
  };

  const workflowFormSections = (mode: 'create' | 'edit') => (
    <>
      <section className="space-y-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
        <h3 className="text-sm font-semibold tracking-wide text-primary">Status</h3>
        <ShippingStepper
          vehicle={{
            payment_status: form.payment_status,
            shipping_status: form.shipping_status,
            customer_id: form.customer_id || selected?.customer_id || null,
            status: form.status,
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Payment status</Label>
            <Select
              value={form.payment_status}
              onValueChange={(v: VehiclePaymentStatus) => setForm({ ...form, payment_status: v })}
              disabled={!canEditVehicle}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Shipping status</Label>
            <Select
              value={form.shipping_status}
              onValueChange={(v: VehicleShippingStatus) => setForm({ ...form, shipping_status: v })}
              disabled={!canEditVehicle}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHIPPING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{SHIPPING_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Legacy stock listing (public catalog)</Label>
            <Select
              value={form.status}
              onValueChange={(v: Vehicle['status']) => setForm({ ...form, status: v })}
              disabled={!canEditVehicle}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Payment and shipping are the primary workflow. Saving them also syncs listing status (in stock, reserved, sold, in transit, exported) unless you set On hold or Archived.
              {!canEditVehicle ? ' Sales roles can see the current stage; only operations staff can override statuses here. Shipped / delivered normally follow B/L documents.' : ' Operations can override any stage here, including shipped / delivered without waiting for documents.'}
            </p>
          </div>
        </div>
      </section>
      <FobFormulaFields
        bidJpy={form.purchase_price}
        expenseJpy={form.expense_jpy}
        ttRate={form.tt_rate}
        onChange={(patch) => setForm({ ...form, ...patch })}
        disabled={!canEditVehicle && mode === 'edit'}
      />
      <section className="space-y-3 rounded-xl border border-border/70 p-4">
        <h3 className="text-sm font-semibold">Vehicle specs</h3>
        <VehicleSpecFields form={form} onChange={(patch) => setForm({ ...form, ...patch })} showPhotos={false} />
        <div className="space-y-1">
          <Label>Source country *</Label>
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
      </section>
      <section className="space-y-3 rounded-xl border border-border/70 p-4">
        <h3 className="text-sm font-semibold">Photos</h3>
        <MultiImageUpload
          folder={chassisStorageFolder(form.chassis_number || form.part_sku || form.stock_number)}
          images={gallery}
          onChange={setGallery}
          label="Gallery"
        />
      </section>
      {mode === 'edit' ? (
        <>
          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold">Reservation</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Customer</Label>
                <Select value={form.customer_id || 'none'} onValueChange={(v) => setForm({ ...form, customer_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Not reserved" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not reserved</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Sold price (USD)</Label><Input type="number" value={form.sold_price} onChange={(e) => setForm({ ...form, sold_price: e.target.value })} placeholder="Can differ from FOB" /></div>
              <div className="space-y-1"><Label>Incoterm</Label>
                <Select value={form.incoterm} onValueChange={(v: VehicleIncoterm) => setForm({ ...form, incoterm: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Hold until</Label><Input type="date" value={form.reserved_until} onChange={(e) => setForm({ ...form, reserved_until: e.target.value })} /></div>
            </div>
          </section>
          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold">Payments</h3>
            <p className="text-xs text-muted-foreground">
              {selected ? PAYMENT_STATUS_LABELS[effectivePaymentStatus(selected)] : ''} · due {form.sold_price || (selected?.fob_usd ?? selected?.listed_price) || '—'} USD
            </p>
            {vehiclePayments.length === 0 ? <p className="text-sm text-muted-foreground">No T/T allocated yet.</p> : (
              <ul className="space-y-1 text-sm">
                {vehiclePayments.map((p) => (
                  <li key={p.id} className="flex justify-between rounded-md border border-border/60 px-2 py-1.5">
                    <span>{p.payment_date} · {p.status}</span>
                    <span>{formatMoney(p.amount, p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canRecordPayment && selected && effectivePaymentStatus(selected) !== 'available' ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1"><Label>Amount USD</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                <Button type="button" size="sm" disabled={submitting} onClick={() => void submitVehiclePayment()}>Allocate</Button>
              </div>
            ) : null}
          </section>
          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold">Booking</h3>
            <p className="text-xs text-muted-foreground">Booking fields on a reserved unit auto-set Booked unless you already chose a shipping status above.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>POL</Label><Input value={form.shipping_port_of_loading} onChange={(e) => setForm({ ...form, shipping_port_of_loading: e.target.value })} /></div>
              <div className="space-y-1"><Label>POD</Label><Input value={form.shipping_port_of_discharge} onChange={(e) => setForm({ ...form, shipping_port_of_discharge: e.target.value })} /></div>
              <div className="space-y-1"><Label>Vessel</Label><Input value={form.shipping_vessel_name} onChange={(e) => setForm({ ...form, shipping_vessel_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>B/L number</Label><Input value={form.shipping_bl_number} onChange={(e) => setForm({ ...form, shipping_bl_number: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Shipping line</Label><Input value={form.shipping_line} onChange={(e) => setForm({ ...form, shipping_line: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>ETD</Label><Input type="date" value={form.shipping_etd} onChange={(e) => setForm({ ...form, shipping_etd: e.target.value })} /></div>
              <div className="space-y-1"><Label>ETA</Label><Input type="date" value={form.shipping_eta} onChange={(e) => setForm({ ...form, shipping_eta: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.shipping_notes} onChange={(e) => setForm({ ...form, shipping_notes: e.target.value })} /></div>
          </section>
          {selected ? (
            <VehicleShippingDocs
              vehicleId={selected.id}
              allowUpload={canEditShipping}
              onChanged={() => { void loadVehicles(); void loadVehiclePayments(selected.id); }}
            />
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={listCopy.title} description={listCopy.description}
        actions={canCreateVehicle ? (
          <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />Add stock</Button>
        ) : undefined} />

      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Total', v: stats.total }, { l: 'Available', v: stats.available }, { l: 'Reserved', v: stats.reserved }].map((s) => (
          <Card key={s.l} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <Card className="border-border/60"><CardContent className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock no., chassis, make…" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {Object.entries(WORKFLOW_STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent></Select>
      </CardContent></Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? <div className="p-14 flex justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
          : filtered.length === 0 ? (
            <div className="p-14 text-center text-muted-foreground">
              <p>No {listCopy.title.toLowerCase()} in this list yet.</p>
              {isSellingFocused ? (
                <p className="mt-2 text-sm">You see available stock plus vehicles you reserved. Other agents&apos; reserved units stay hidden.</p>
              ) : null}
            </div>
          )
          : <div className="divide-y">{filtered.map((v) => {
            const pay = effectivePaymentStatus(v);
            const stage = workflowStage(v);
            return (
            <div key={v.id} className="flex items-center gap-3 p-4 hover:bg-muted/40">
              <button type="button" className="flex flex-1 items-center gap-3 text-left" onClick={() => setSelected(v)}>
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
                  {v.primary_image_url ? <img src={v.primary_image_url} alt="" className="h-full w-full object-cover" /> : <CarFront className="h-5 w-5 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.make} {v.model}</p>
                  <p className="text-xs text-muted-foreground">{v.stock_number}{v.model_year ? ` · ${v.model_year}` : ''}</p>
                </div>
                <div className="hidden min-w-[9rem] text-right sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">FOB</p>
                  <p className="text-sm font-semibold">{fobLabel(v)}</p>
                  {pay !== 'available' && (v.sold_price != null || v.incoterm) ? (
                    <p className="text-xs text-muted-foreground">{v.incoterm || 'FOB'} {v.sold_price != null ? formatMoney(Number(v.sold_price), 'USD') : ''}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className={PAYMENT_STATUS_STYLES[pay]}>{PAYMENT_STATUS_LABELS[pay]}</Badge>
                  <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(v)]}>{WORKFLOW_STAGE_LABELS[stage]}</Badge>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            );
          })}</div>}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent fullscreen>
        <DialogHeader><DialogTitle>Add {stockCategoryLabel(listCategory).toLowerCase()}</DialogTitle></DialogHeader>
        <form onSubmit={submitCreate} className="space-y-4">
          {workflowFormSections('create')}
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent fullscreen>
        <DialogHeader><DialogTitle>Edit stock</DialogTitle></DialogHeader>
        <form onSubmit={submitEdit} className="space-y-4">
          {workflowFormSections('edit')}
          <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Sheet open={!!selected && !editOpen && !deleteOpen && !reserveOpen && !shippingOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">{selected && (<>
          <SheetHeader><SheetTitle>{selected.make} {selected.model}</SheetTitle><SheetDescription>{selected.stock_number} · {statusLabels[selected.status]}</SheetDescription></SheetHeader>
          {selected.primary_image_url && <img src={selected.primary_image_url} alt="" className="mt-4 rounded-lg w-full max-h-48 object-cover" />}
          <div className="mt-4"><ShippingStepper vehicle={selected} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-[10px] uppercase text-muted-foreground">FOB</p><p className="font-semibold">{fobLabel(selected)}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Sold / term</p><p className="font-semibold">{selected.sold_price != null ? `${formatMoney(Number(selected.sold_price), 'USD')} ${selected.incoterm || ''}` : (selected.incoterm || '—')}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className={PAYMENT_STATUS_STYLES[effectivePaymentStatus(selected)]}>{PAYMENT_STATUS_LABELS[effectivePaymentStatus(selected)]}</Badge>
            <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(selected)]}>{SHIPPING_STATUS_LABELS[effectiveShippingStatus(selected)]}</Badge>
          </div>
          {selected.customer_id && (
            <p className="mt-2 text-sm text-muted-foreground">Buyer: {customerLabel(selected.customer_id)}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {canReserveStock && effectivePaymentStatus(selected) === 'available' && (
              <Button size="sm" onClick={openReserve}><Tag className="h-3.5 w-3.5 mr-1" />Reserve</Button>
            )}
            {canEditVehicle && (
              <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" />Edit stock</Button>
            )}
            {canEditShipping && (
              <Button size="sm" variant="outline" onClick={openShippingEdit}><Ship className="h-3.5 w-3.5 mr-1" />Booking</Button>
            )}
            {canDeleteVehicle && (
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            )}
          </div>
          <VehicleShippingDocs
            vehicleId={selected.id}
            allowUpload={canEditShipping}
            onChanged={() => { void loadVehicles(); }}
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
          <div className="space-y-1"><Label>Sold price (USD)</Label><Input type="number" value={reserveSoldPrice} onChange={(e) => setReserveSoldPrice(e.target.value)} /></div>
          <div className="space-y-1"><Label>Incoterm</Label>
            <Select value={reserveIncoterm} onValueChange={(v: VehicleIncoterm) => setReserveIncoterm(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Hold (days)</Label><Input type="number" min={1} value={reserveDays} onChange={(e) => setReserveDays(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={submitting || !reserveCustomerId}>Confirm reserve</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={shippingOpen} onOpenChange={setShippingOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Booking details</DialogTitle></DialogHeader>
        <form onSubmit={submitShipping} className="space-y-3">
          {selected ? <ShippingStepper vehicle={selected} /> : null}
          <p className="text-xs text-muted-foreground">Saving these fields on a reserved unit sets Booked automatically.</p>
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
          <DialogFooter><Button type="submit" disabled={submitting}>Save booking</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete vehicle?" description="Removes available stock only. Reserved or invoiced units are blocked." confirmLabel="Delete" destructive loading={submitting} onConfirm={confirmDelete} />
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
