'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StockListCard } from '@/components/vehicles/stock-list-card';
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
  commissionAmountPkr,
  effectiveCommissionStatus,
  effectivePaymentStatus,
  effectiveShippingStatus,
  parsePkrPerUsd,
  reservationExclusivityMessage,
  emptyShippingForm,
  FREIGHT_MODE_LABELS,
  FREIGHT_MODES,
  INCOTERMS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  PAYMENT_STATUSES,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUS_STYLES,
  SHIPPING_STATUSES,
  soldProfitUsd,
  suggestCommissionPkr,
  WORKFLOW_STAGE_LABELS,
  workflowStage,
  type VehicleFreightMode,
  type VehicleIncoterm,
  type VehiclePaymentStatus,
  type VehicleShippingStatus,
} from '@/lib/vehicle-lifecycle';
import { makeVehicleAvailable, vehicleCanMakeAvailable } from '@/lib/utils/make-vehicle-available';
import { Loader2, Pencil, Plus, Search, Ship, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type VehicleInvoiceRef = { id: string; invoice_code: string };
type ProfileNameRow = { id: string; full_name: string | null; display_name: string | null; email: string | null };
type CustomerListRow = Pick<Customer, 'id' | 'full_name' | 'customer_code' | 'country'>;
type VehiclePayAgg = { count: number; allocated: number };

function profileDisplayName(p: ProfileNameRow | undefined) {
  if (!p) return '';
  return p.full_name?.trim() || p.display_name?.trim() || p.email || '';
}

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
  customer_id: '', sold_price: '', incoterm: 'FOB' as VehicleIncoterm,
  freight_mode: '' as '' | VehicleFreightMode, reserved_until: '',
  commission_pkr: '',
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
  const router = useRouter();
  const listCategory: StockCategory =
    searchParams.get('category') === 'machinery' || searchParams.get('category') === 'parts'
      ? (searchParams.get('category') as StockCategory)
      : 'car';
  const listCopy = LIST_TITLES[listCategory];
  const { profile } = useAuth();
  const { can, hasRole, isSellingFocused, isAdmin } = usePermissions();
  const canCreateVehicle = can('vehicles', 'create');
  const canEditVehicle = can('vehicles', 'edit');
  const canDeleteVehicle = can('vehicles', 'delete');
  const canOverrideReservation = isAdmin() || hasRole('operations') || hasRole('manager');
  const canMakeAvailable = isAdmin();
  const canReserveStock =
    (hasRole('sales_agent') || hasRole('freelancer')) && !canEditVehicle;
  const canEditShipping = canEditVehicle;
  const canRecordPayment = can('payments', 'create');
  const canMarkCommissionPaid = isAdmin() || hasRole('manager') || hasRole('accounts');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [vehiclePays, setVehiclePays] = useState<Record<string, VehiclePayAgg>>({});
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [saleFallback, setSaleFallback] = useState<Record<string, { agentId: string; customerId: string }>>({});
  const [vehicleInvoices, setVehicleInvoices] = useState<Record<string, VehicleInvoiceRef>>({});
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [vehiclePayments, setVehiclePayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [makeAvailableOpen, setMakeAvailableOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [reserveCustomerId, setReserveCustomerId] = useState('');
  const [reserveDays, setReserveDays] = useState('7');
  const [reserveSoldPrice, setReserveSoldPrice] = useState('');
  const [reserveIncoterm, setReserveIncoterm] = useState<VehicleIncoterm>('FOB');
  const [reserveFreightMode, setReserveFreightMode] = useState<'' | VehicleFreightMode>('');
  const [reserveCommissionPkr, setReserveCommissionPkr] = useState('');
  const [pkrPerUsd, setPkrPerUsd] = useState<number | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState(emptyShippingForm);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    await supabase.rpc('expire_reserved_vehicles');
    const [vRes, cRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('updated_at', { ascending: false }).limit(250),
      supabase.from('customers').select('id, full_name, customer_code, country').order('full_name').limit(250),
    ]);
    if (vRes.error) toast.error(`Unable to load inventory: ${vRes.error.message}`);
    const list = (vRes.data || []) as Vehicle[];
    setVehicles(list);
    setSelected((prev) => (prev ? list.find((row) => row.id === prev.id) ?? prev : null));

    let customerRows = (cRes.data || []) as CustomerListRow[];
    const vehicleIds = list.map((v) => v.id);
    const listedCustomerIds = new Set(customerRows.map((c) => c.id));
    const missingCustomerIds = [
      ...new Set(
        list
          .map((v) => v.customer_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0 && !listedCustomerIds.has(id))
      ),
    ];

    const [missCustRes, salesRes, itemRes] = await Promise.all([
      missingCustomerIds.length
        ? supabase.from('customers').select('id, full_name, customer_code, country').in('id', missingCustomerIds)
        : Promise.resolve({ data: [] as CustomerListRow[] }),
      vehicleIds.length
        ? supabase.from('sales').select('vehicle_id, customer_id, created_by, created_at').in('vehicle_id', vehicleIds).neq('status', 'cancelled')
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string; customer_id: string; created_by: string; created_at: string }> }),
      vehicleIds.length
        ? supabase.from('invoice_items').select('vehicle_id, invoice_id, created_at').in('vehicle_id', vehicleIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string | null; invoice_id: string; created_at: string }> }),
    ]);
    if (missCustRes.data?.length) customerRows = [...customerRows, ...missCustRes.data];
    setCustomers(customerRows);

    const saleByVehicle = new Map<string, { customer_id: string; created_by: string }>();
    for (const s of salesRes.data || []) {
      if (!saleByVehicle.has(s.vehicle_id)) saleByVehicle.set(s.vehicle_id, s);
    }
    const fallback: Record<string, { agentId: string; customerId: string }> = {};
    for (const [vid, s] of saleByVehicle) {
      fallback[vid] = { agentId: s.created_by, customerId: s.customer_id };
    }
    setSaleFallback(fallback);

    const agentIds = new Set<string>();
    for (const v of list) {
      if (v.reserved_by) agentIds.add(v.reserved_by);
      const sale = saleByVehicle.get(v.id);
      if (!v.reserved_by && sale?.created_by) agentIds.add(sale.created_by);
      if (!v.customer_id && sale?.customer_id && !customerRows.some((c) => c.id === sale.customer_id)) {
        missingCustomerIds.push(sale.customer_id);
      }
    }
    if (missingCustomerIds.length) {
      const { data: moreCust } = await supabase.from('customers').select('id, full_name, customer_code, country').in('id', missingCustomerIds);
      if (moreCust?.length) {
        customerRows = [...customerRows, ...moreCust];
        setCustomers(customerRows);
      }
    }

    const names: Record<string, string> = {};
    if (agentIds.size) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .in('id', [...agentIds]);
      for (const p of (profiles || []) as ProfileNameRow[]) {
        const label = profileDisplayName(p);
        if (label) names[p.id] = label;
      }
    }
    setAgentNames(names);

    const invoiceMap: Record<string, VehicleInvoiceRef> = {};
    const itemRows = itemRes.data || [];
    const invoiceIds = [...new Set(itemRows.map((r) => r.invoice_id).filter(Boolean))];
    if (invoiceIds.length) {
      const { data: invRows } = await supabase.from('invoices').select('id, invoice_code').in('id', invoiceIds);
      const byId = new Map((invRows || []).map((inv) => [inv.id as string, inv as VehicleInvoiceRef]));
      for (const row of itemRows) {
        if (!row.vehicle_id || invoiceMap[row.vehicle_id]) continue;
        const inv = byId.get(row.invoice_id);
        if (inv?.invoice_code) invoiceMap[row.vehicle_id] = inv;
      }
    }
    setVehicleInvoices(invoiceMap);

    const payMap: Record<string, VehiclePayAgg> = {};
    if (vehicleIds.length) {
      const { data: allocRows } = await supabase
        .from('payment_allocations')
        .select('vehicle_id, allocate_amount, payments(status)')
        .in('vehicle_id', vehicleIds);
      if (allocRows?.length) {
        for (const a of allocRows) {
          const status = (a.payments as { status?: string } | null)?.status;
          if (!a.vehicle_id || status === 'rejected') continue;
          const row = payMap[a.vehicle_id] || { count: 0, allocated: 0 };
          row.count += 1;
          if (!status || status === 'received' || status === 'reconciled' || status === 'pending') {
            row.allocated += Number(a.allocate_amount) || 0;
          }
          payMap[a.vehicle_id] = row;
        }
      } else {
        const { data: payRows } = await supabase
          .from('payments')
          .select('id, vehicle_id, amount, currency, status')
          .in('vehicle_id', vehicleIds);
        for (const p of payRows || []) {
          if (!p.vehicle_id || p.status === 'rejected') continue;
          const row = payMap[p.vehicle_id] || { count: 0, allocated: 0 };
          row.count += 1;
          if (p.status === 'received' || p.status === 'reconciled' || p.status === 'pending') {
            row.allocated += Number(p.amount) || 0;
          }
          payMap[p.vehicle_id] = row;
        }
      }
    }
    setVehiclePays(payMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  useEffect(() => {
    void supabase.from('system_config').select('value').eq('key', 'pkr_per_usd').maybeSingle().then(({ data }) => {
      setPkrPerUsd(parsePkrPerUsd(data?.value));
    });
  }, []);

  const loadVehiclePayments = useCallback(async (vehicleId: string) => {
    const { data: allocs } = await supabase
      .from('payment_allocations')
      .select('allocate_amount, payments(*)')
      .eq('vehicle_id', vehicleId);
    if (allocs?.length) {
      const mapped = allocs
        .map((row) => {
          const p = row.payments as Payment | Payment[] | null;
          const pay = Array.isArray(p) ? p[0] : p;
          if (!pay) return null;
          return { ...pay, amount: Number(row.allocate_amount) || pay.amount };
        })
        .filter(Boolean) as Payment[];
      setVehiclePayments(mapped);
      return;
    }
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
      const agent = agentNames[v.reserved_by || saleFallback[v.id]?.agentId || ''] || '';
      const customer = customers.find((c) => c.id === (v.customer_id || saleFallback[v.id]?.customerId))?.full_name || '';
      const invoiceCode = vehicleInvoices[v.id]?.invoice_code || '';
      const matchesSearch = !q || [v.stock_number, v.chassis_number, v.part_sku, v.make, v.model, agent, customer, invoiceCode].filter(Boolean).some((val) => String(val).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [vehicles, search, statusFilter, listCategory, agentNames, saleFallback, customers, vehicleInvoices]);

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
      freight_mode: v.freight_mode === 'roro' || v.freight_mode === 'container' ? v.freight_mode : '',
      commission_pkr: v.commission_pkr != null ? String(v.commission_pkr) : '',
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

  const openEdit = async (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    const imgs = await loadVehicleImages(target.id);
    setGallery(imgs.length ? imgs : (target.primary_image_url ? [{ image_url: target.primary_image_url, sort_order: 0, is_primary: true }] : []));
    fillFormFromVehicle(target);
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
      sold_price: formState.sold_price ? Number(formState.sold_price) : null,
      incoterm: formState.incoterm || 'FOB',
      freight_mode: formState.freight_mode === 'roro' || formState.freight_mode === 'container' ? formState.freight_mode : null,
      commission_pkr: formState.commission_pkr === '' ? null : Number(formState.commission_pkr) || 0,
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
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd|sold_price|incoterm|freight_mode|commission_pkr|commission_status/i.test(error.message)) {
      const rest = { ...insertPayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.tt_rate;
      delete rest.fob_usd;
      delete rest.sold_price;
      delete rest.incoterm;
      delete rest.freight_mode;
      delete rest.commission_pkr;
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
      incoterm: form.incoterm || selected.incoterm || null,
      freight_mode: form.freight_mode === 'roro' || form.freight_mode === 'container' ? form.freight_mode : null,
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
    } else if (reserving && (!selected.reserved_by || canOverrideReservation)) {
      updatePayload.reserved_by = profile?.id || selected.reserved_by;
    } else if (
      canOverrideReservation
      && !form.customer_id
      && form.payment_status === 'available'
    ) {
      updatePayload.reserved_by = null;
      updatePayload.reserved_until = null;
    }
    const editConflict =
      reserving && !canOverrideReservation
        ? reservationExclusivityMessage(selected, profile?.id, agentNames)
        : null;
    if (editConflict) {
      setSubmitting(false);
      toast.error(editConflict);
      return;
    }
    let { error } = await supabase.from('vehicles').update(updatePayload).eq('id', selected.id);
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd|sold_price|incoterm|freight_mode|commission_pkr|commission_status/i.test(error.message)) {
      const rest = { ...updatePayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.tt_rate;
      delete rest.fob_usd;
      delete rest.sold_price;
      delete rest.incoterm;
      delete rest.freight_mode;
      delete rest.commission_pkr;
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

  const openMakeAvailable = (vehicle?: Vehicle | null) => {
    if (!canMakeAvailable) {
      toast.error('Only admin can make a vehicle available');
      return;
    }
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setMakeAvailableOpen(true);
  };

  const confirmMakeAvailable = async () => {
    if (!profile || !selected) return;
    if (!canMakeAvailable) {
      toast.error('Only admin can make a vehicle available');
      return;
    }
    setSubmitting(true);
    const result = await makeVehicleAvailable({ vehicle: selected, actorId: profile.id });
    setSubmitting(false);
    if (!result.ok) {
      if (result.block?.kind === 'tt_allocated') {
        const href = result.block.allocateHref;
        toast.error(result.block.message, {
          action: {
            label: 'Open allocate',
            onClick: () => router.push(href),
          },
        });
        setMakeAvailableOpen(false);
        return;
      }
      toast.error(result.error);
      return;
    }
    toast.success(`${selected.stock_number} is available again`);
    setMakeAvailableOpen(false);
    setSelected(null);
    await loadVehicles();
  };

  const customerLabel = (id: string | null | undefined) =>
    id ? customers.find((c) => c.id === id)?.full_name || 'Customer' : '';

  const rowAgentName = (v: Vehicle) =>
    agentNames[v.reserved_by || saleFallback[v.id]?.agentId || ''] || '';

  const rowCustomerName = (v: Vehicle) =>
    customerLabel(v.customer_id || saleFallback[v.id]?.customerId);

  const rowCustomerCountry = (v: Vehicle) => {
    const id = v.customer_id || saleFallback[v.id]?.customerId;
    const country = id ? customers.find((c) => c.id === id)?.country : null;
    return (country || '').trim();
  };

  const rowCurrency = (v: Vehicle) => v.listed_currency || 'USD';

  const freightLabel = (v: Vehicle) =>
    v.freight_mode === 'roro' || v.freight_mode === 'container' ? FREIGHT_MODE_LABELS[v.freight_mode] : '';

  const openReserve = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    const conflict = reservationExclusivityMessage(target, profile?.id, agentNames);
    if (conflict) {
      toast.error(conflict);
      return;
    }
    setSelected(target);
    setReserveCustomerId(target.customer_id || '');
    setReserveDays('7');
    setReserveSoldPrice(target.sold_price != null ? String(target.sold_price) : (target.fob_usd != null ? String(target.fob_usd) : target.listed_price != null ? String(target.listed_price) : ''));
    setReserveIncoterm((target.incoterm as VehicleIncoterm) || 'FOB');
    setReserveFreightMode(target.freight_mode === 'roro' || target.freight_mode === 'container' ? target.freight_mode : '');
    setReserveCommissionPkr(target.commission_pkr != null ? String(target.commission_pkr) : '');
    setReserveOpen(true);
  };

  const submitReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selected || !reserveCustomerId) return;
    setSubmitting(true);
    const { data: fresh, error: freshErr } = await supabase
      .from('vehicles')
      .select('id, status, payment_status, reserved_by')
      .eq('id', selected.id)
      .maybeSingle();
    if (freshErr) {
      setSubmitting(false);
      toast.error(freshErr.message);
      return;
    }
    const live = (fresh || selected) as Pick<Vehicle, 'id' | 'status' | 'payment_status' | 'reserved_by'>;
    let names = agentNames;
    if (live.reserved_by && !names[live.reserved_by]) {
      const { data: holder } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .eq('id', live.reserved_by)
        .maybeSingle();
      if (holder) {
        names = { ...names, [holder.id]: profileDisplayName(holder as ProfileNameRow) };
      }
    }
    const conflict = reservationExclusivityMessage(live, profile.id, names);
    if (conflict) {
      setSubmitting(false);
      toast.error(conflict);
      setReserveOpen(false);
      await loadVehicles();
      return;
    }
    const days = Math.max(1, Number(reserveDays) || 7);
    const reservedUntil = new Date();
    reservedUntil.setDate(reservedUntil.getDate() + days);
    const reservedUntilStr = reservedUntil.toISOString().slice(0, 10);
    const { data: claimed, error } = await supabase
      .from('vehicles')
      .update({
        payment_status: 'reserved',
        customer_id: reserveCustomerId,
        reserved_by: profile.id,
        reserved_until: reservedUntilStr,
        sold_price: reserveSoldPrice ? Number(reserveSoldPrice) : null,
        incoterm: reserveIncoterm,
        freight_mode: reserveFreightMode === 'roro' || reserveFreightMode === 'container' ? reserveFreightMode : null,
        commission_pkr: reserveCommissionPkr === '' ? null : Number(reserveCommissionPkr) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id)
      .eq('payment_status', 'available')
      .is('reserved_by', null)
      .select('id')
      .maybeSingle();
    if (error) {
      setSubmitting(false);
      const msg = /already reserved by/i.test(error.message)
        ? error.message.replace(/^.*already reserved by/i, 'Already reserved by')
        : error.message;
      toast.error(msg);
      return;
    }
    if (!claimed) {
      setSubmitting(false);
      toast.error(reservationExclusivityMessage(live, profile.id, names) || 'Already reserved by another agent');
      setReserveOpen(false);
      await loadVehicles();
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

  const openShippingEdit = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setShippingForm({
      shipping_port_of_loading: target.shipping_port_of_loading || '',
      shipping_port_of_discharge: target.shipping_port_of_discharge || '',
      shipping_vessel_name: target.shipping_vessel_name || '',
      shipping_bl_number: target.shipping_bl_number || '',
      shipping_line: target.shipping_line || '',
      shipping_etd: target.shipping_etd || '',
      shipping_eta: target.shipping_eta || '',
      shipping_notes: target.shipping_notes || '',
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

  const markCommissionPaid = async (vehicleId: string) => {
    if (!canMarkCommissionPaid) {
      toast.error('Only admin, manager, or accounts can mark commission paid');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .update({ commission_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', vehicleId);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Commission marked paid');
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
      remit_date: payDate || new Date().toISOString().split('T')[0],
      received_date: payDate || new Date().toISOString().split('T')[0],
      amount,
      remit_amount: amount,
      instructed_amount: amount,
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
          {selected && commissionAmountPkr(selected) != null && Number(selected.commission_pkr) > 0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              {effectiveCommissionStatus(selected) === 'paid' ? (
                <Badge className="border-emerald-600 bg-emerald-600 text-white">Commission paid</Badge>
              ) : effectiveCommissionStatus(selected) === 'due' ? (
                <Badge variant="outline" className="border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900">Commission due</Badge>
              ) : (
                <Badge variant="outline">Commission recorded</Badge>
              )}
              <span className="text-sm">{formatMoney(Number(selected.commission_pkr), 'PKR')}</span>
              {canMarkCommissionPaid && effectiveCommissionStatus(selected) === 'due' ? (
                <Button type="button" size="sm" disabled={submitting} onClick={() => void markCommissionPaid(selected.id)}>
                  Mark commission paid
                </Button>
              ) : null}
            </div>
          ) : null}
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
        <h3 className="text-sm font-semibold">Sale terms</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Sold price (USD)</Label><Input type="number" value={form.sold_price} onChange={(e) => setForm({ ...form, sold_price: e.target.value })} placeholder="Can differ from FOB" /></div>
          <div className="space-y-1"><Label>Shipment term</Label>
            <Select value={form.incoterm} onValueChange={(v: VehicleIncoterm) => setForm({ ...form, incoterm: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Freight mode</Label>
            <Select value={form.freight_mode || 'none'} onValueChange={(v) => setForm({ ...form, freight_mode: v === 'none' ? '' : (v as VehicleFreightMode) })}>
              <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {FREIGHT_MODES.map((m) => <SelectItem key={m} value={m}>{FREIGHT_MODE_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Commission (PKR)</Label>
            <Input type="number" min={0} value={form.commission_pkr} onChange={(e) => setForm({ ...form, commission_pkr: e.target.value })} placeholder="Enter PKR" />
            {pkrPerUsd != null && soldProfitUsd({ sold_price: form.sold_price ? Number(form.sold_price) : null, fob_usd: fobFromForm(form)?.fobUsd ?? selected?.fob_usd ?? null, listed_price: selected?.listed_price ?? null }) != null ? (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => {
                  const profit = soldProfitUsd({
                    sold_price: form.sold_price ? Number(form.sold_price) : null,
                    fob_usd: fobFromForm(form)?.fobUsd ?? selected?.fob_usd ?? null,
                    listed_price: selected?.listed_price ?? null,
                  });
                  const suggested = suggestCommissionPkr(profit, pkrPerUsd, 10);
                  if (suggested != null) setForm({ ...form, commission_pkr: String(suggested) });
                }}
              >
                Use 10% of USD profit at configured PKR/USD ({pkrPerUsd})
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">Staff type the PKR amount. FX is not applied unless a pkr_per_usd rate exists in config.</p>
            )}
          </div>
        </div>
      </section>
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
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{s.l}</p><p className="erp-stat-value mt-0.5">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-4">
        <div className="erp-filter-bar">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock no., chassis, make…" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {Object.entries(WORKFLOW_STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent></Select>
        </div>
      </CardContent></Card>

      {loading ? (
        <Card><div className="flex justify-center p-12"><Loader2 className="h-4 w-4 animate-spin" /></div></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-muted-foreground">
            <p>No {listCopy.title.toLowerCase()} in this list yet.</p>
            {isSellingFocused ? (
              <p className="mt-2 text-sm">You see available stock plus vehicles you reserved. Other agents&apos; reserved units stay hidden.</p>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const pay = effectivePaymentStatus(v);
            const pays = vehiclePays[v.id];
            return (
              <StockListCard
                key={v.id}
                vehicle={v}
                checked={Boolean(checkedIds[v.id])}
                onCheckedChange={(on) => setCheckedIds((prev) => ({ ...prev, [v.id]: on }))}
                customerName={rowCustomerName(v)}
                customerCountry={rowCustomerCountry(v)}
                agentName={rowAgentName(v)}
                invoice={vehicleInvoices[v.id] || null}
                paymentCount={pays?.count || 0}
                allocatedUsd={pays?.allocated || 0}
                onViewInfo={() => setSelected(v)}
                onEdit={canEditVehicle ? () => { void openEdit(v); } : undefined}
                onReserve={canReserveStock && pay === 'available' ? () => openReserve(v) : undefined}
                onMakeAvailable={
                  canMakeAvailable && vehicleCanMakeAvailable(v)
                    ? () => openMakeAvailable(v)
                    : undefined
                }
                onShipping={canEditShipping ? () => openShippingEdit(v) : undefined}
                onDelete={canDeleteVehicle ? () => { setSelected(v); setDeleteOpen(true); } : undefined}
                onMarkCommissionPaid={
                  canMarkCommissionPaid && effectiveCommissionStatus(v) === 'due'
                    ? () => { void markCommissionPaid(v.id); }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

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

      <Sheet open={!!selected && !editOpen && !deleteOpen && !reserveOpen && !shippingOpen && !makeAvailableOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">{selected && (<>
          <SheetHeader><SheetTitle>{selected.make} {selected.model}</SheetTitle><SheetDescription>{selected.stock_number} · {statusLabels[selected.status]}</SheetDescription></SheetHeader>
          {selected.primary_image_url && <img src={selected.primary_image_url} alt="" className="mt-4 rounded-lg w-full max-h-48 object-cover" />}
          <div className="mt-4"><ShippingStepper vehicle={selected} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-[10px] uppercase text-muted-foreground">FOB</p><p className="font-semibold">{fobLabel(selected)}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Sold / term</p><p className="font-semibold">{selected.sold_price != null ? `${formatMoney(Number(selected.sold_price), rowCurrency(selected))} ${selected.incoterm || ''}` : (selected.incoterm || '—')}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Freight</p><p className="font-semibold">{freightLabel(selected) || '—'}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Profit</p><p className="font-semibold">{soldProfitUsd(selected) != null ? formatMoney(soldProfitUsd(selected), rowCurrency(selected)) : '—'}</p></div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Commission</p>
              <p className="font-semibold">
                {commissionAmountPkr(selected) != null && Number(selected.commission_pkr) > 0
                  ? formatMoney(Number(selected.commission_pkr), 'PKR')
                  : '—'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className={PAYMENT_STATUS_STYLES[effectivePaymentStatus(selected)]}>{PAYMENT_STATUS_LABELS[effectivePaymentStatus(selected)]}</Badge>
            <Badge variant="outline" className={SHIPPING_STATUS_STYLES[effectiveShippingStatus(selected)]}>{SHIPPING_STATUS_LABELS[effectiveShippingStatus(selected)]}</Badge>
            {effectiveCommissionStatus(selected) === 'paid' ? (
              <Badge className="border-emerald-600 bg-emerald-600 text-white">Commission paid</Badge>
            ) : effectiveCommissionStatus(selected) === 'due' ? (
              <Badge variant="outline" className="border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900">Commission due</Badge>
            ) : null}
          </div>
          {rowAgentName(selected) ? (
            <p className="mt-2 text-sm text-muted-foreground">Reserved by: {rowAgentName(selected)}</p>
          ) : null}
          {rowCustomerName(selected) ? (
            <p className="text-sm text-muted-foreground">Customer: {rowCustomerName(selected)}</p>
          ) : null}
          {vehicleInvoices[selected.id] ? (
            <p className="text-sm">
              Invoice:{' '}
              <Link className="font-medium text-primary underline" href={`/invoices?q=${encodeURIComponent(vehicleInvoices[selected.id].invoice_code)}`}>
                {vehicleInvoices[selected.id].invoice_code}
              </Link>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {canReserveStock && effectivePaymentStatus(selected) === 'available' && (
              <Button size="sm" onClick={() => openReserve()}><Tag className="h-3.5 w-3.5 mr-1" />Reserve</Button>
            )}
            {canEditVehicle && (
              <Button size="sm" variant="outline" onClick={() => { void openEdit(); }}><Pencil className="h-3.5 w-3.5 mr-1" />Edit stock</Button>
            )}
            {canEditShipping && (
              <Button size="sm" variant="outline" onClick={() => openShippingEdit()}><Ship className="h-3.5 w-3.5 mr-1" />Booking</Button>
            )}
            {canDeleteVehicle && (
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            )}
            {canMarkCommissionPaid && effectiveCommissionStatus(selected) === 'due' && (
              <Button size="sm" disabled={submitting} onClick={() => void markCommissionPaid(selected.id)}>Mark commission paid</Button>
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
          <div className="space-y-1"><Label>Shipment term</Label>
            <Select value={reserveIncoterm} onValueChange={(v: VehicleIncoterm) => setReserveIncoterm(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCOTERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Freight mode</Label>
            <Select value={reserveFreightMode || 'none'} onValueChange={(v) => setReserveFreightMode(v === 'none' ? '' : (v as VehicleFreightMode))}>
              <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {FREIGHT_MODES.map((m) => <SelectItem key={m} value={m}>{FREIGHT_MODE_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Hold (days)</Label><Input type="number" min={1} value={reserveDays} onChange={(e) => setReserveDays(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Commission (PKR)</Label>
            <Input type="number" min={0} value={reserveCommissionPkr} onChange={(e) => setReserveCommissionPkr(e.target.value)} placeholder="Enter PKR" />
            {pkrPerUsd != null && soldProfitUsd({ sold_price: reserveSoldPrice ? Number(reserveSoldPrice) : selected?.sold_price ?? null, fob_usd: selected?.fob_usd ?? null, listed_price: selected?.listed_price ?? null }) != null ? (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => {
                  const suggested = suggestCommissionPkr(
                    soldProfitUsd({
                      sold_price: reserveSoldPrice ? Number(reserveSoldPrice) : selected?.sold_price ?? null,
                      fob_usd: selected?.fob_usd ?? null,
                      listed_price: selected?.listed_price ?? null,
                    }),
                    pkrPerUsd,
                    10
                  );
                  if (suggested != null) setReserveCommissionPkr(String(suggested));
                }}
              >
                Use 10% of USD profit at configured PKR/USD ({pkrPerUsd})
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">Type the commission in PKR. No FX is applied unless pkr_per_usd is configured.</p>
            )}
          </div>
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
      <ConfirmDialog
        open={makeAvailableOpen}
        onOpenChange={setMakeAvailableOpen}
        title="Make vehicle available?"
        description="This clears the reservation (agent, customer, sold price, commission), deletes or trims linked reservation invoices, and sets the unit back to available / in stock. If a remittance / TT is still allocated to this vehicle, you must unallocate it first."
        confirmLabel="Make available"
        destructive
        loading={submitting}
        onConfirm={confirmMakeAvailable}
      />
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
