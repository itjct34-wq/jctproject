'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StockListCard } from '@/components/vehicles/stock-list-card';
import { StockListFilters, type StockListFiltersValue } from '@/components/stock/stock-list-filters';
import { StockListPagination } from '@/components/stock/stock-list-pagination';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErpEmptyState } from '@/components/shared/erp-empty-state';
import { type GalleryImage, MultiImageUpload } from '@/components/shared/multi-image-upload';
import { loadVehicleImages, saveVehicleImages } from '@/lib/utils/vehicle-images';
import {
  uploadVehiclePhotoZipForId,
  VehiclePhotoZipUpload,
} from '@/components/vehicles/vehicle-photo-zip-upload';
import { pickPrimaryImageUrl } from '@/lib/vehicles/image-role';
import { mapTransmissionToDb, VehicleSpecFields } from '@/components/vehicles/vehicle-spec-fields';
import { FobFormulaFields } from '@/components/vehicles/fob-formula-fields';
import { StockSourcingFields } from '@/components/vehicles/stock-sourcing-fields';
import { EditCourierDialog } from '@/components/vehicles/edit-courier-dialog';
import { EditShippingDialog } from '@/components/vehicles/edit-shipping-dialog';
import { AssignStockDialog } from '@/components/vehicles/assign-stock-dialog';
import { SetBidRequesterDialog } from '@/components/vehicles/set-bid-requester-dialog';
import { ReserveVehicleDialog } from '@/components/vehicles/reserve-vehicle-dialog';
import { ShippingStepper } from '@/components/vehicles/shipping-stepper';
import { VehicleViewInfoDialog } from '@/components/vehicles/vehicle-view-info-dialog';
import type { VehicleRemittanceRef } from '@/components/vehicles/vehicle-remittance-popover';
import { SOURCE_COUNTRIES, resolveSourceCountry } from '@/lib/source-countries';
import { parseStockCategory, stockCategoryLabel, type StockCategory } from '@/lib/stock-category';
import {
  clampStockPage,
  DEFAULT_STOCK_PAGE_SIZE,
  parseStockPage,
  parseStockPageSize,
  type StockPageSize,
} from '@/lib/stock-list-paging';
import { nextVehicleStockNumber } from '@/lib/utils/stock-number';
import { mergeEngineIntoNotes, publicEngineFromNotes, stripEngineFromNotes } from '@/lib/public/vehicles';
import { chassisStorageFolder } from '@/lib/utils/chassis';
import { calcFobFromBid, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';
import {
  fobFieldsFromOncePrice,
  isOwnStockListVehicle,
  isThirdPartyVehicle,
} from '@/lib/vehicles/procurement';
import type { Customer, Office, Vehicle } from '@/lib/types';
import {
  commissionAmountPkr,
  effectiveCommissionStatus,
  effectivePaymentStatus,
  effectiveShippingStatus,
  incotermSelectOptions,
  reservationExclusivityMessage,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUSES,
  workflowStage,
  type VehicleIncoterm,
  type VehiclePaymentStatus,
  type VehicleShippingStatus,
} from '@/lib/vehicle-lifecycle';
import {
  isIncompletePayment,
  parsePaymentQuery,
  parseShippingQuery,
} from '@/lib/vehicles/lifecycle-metrics';
import { makeVehicleAvailable, vehicleCanMakeAvailable } from '@/lib/utils/make-vehicle-available';
import Link from 'next/link';
import { CarFront, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

type VehicleInvoiceRef = { id: string; invoice_code: string };
type ProfileNameRow = { id: string; full_name: string | null; display_name: string | null; email: string | null };
type CustomerListRow = Pick<
  Customer,
  | 'id'
  | 'full_name'
  | 'customer_code'
  | 'country'
  | 'city'
  | 'address_line1'
  | 'phone'
  | 'email'
  | 'default_currency'
  | 'assigned_to'
  | 'company_name'
  | 'port_of_discharge'
>;
type VehiclePayAgg = { count: number; allocated: number; remittances: VehicleRemittanceRef[] };

const STOCK_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial_paid', label: 'Partial Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'hidden', label: 'Hidden' },
];

const emptyListFilters = (): StockListFiltersValue => ({
  search: '',
  status: '',
  make: '',
  model: '',
  customer: '',
  agent: '',
});

function profileDisplayName(p: ProfileNameRow | undefined) {
  if (!p) return '';
  return p.full_name?.trim() || p.display_name?.trim() || p.email || '';
}

const statusLabels: Record<Vehicle['status'], string> = {
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', in_transit: 'In transit',
  exported: 'Exported', on_hold: 'On hold', archived: 'Archived', hidden: 'Hidden',
};

const emptyForm = {
  stock_category: 'car' as StockCategory,
  chassis_number: '', stock_number: '', part_sku: '', make: '', model: '', colour: '', model_year: '',
  engine: '', transmission: '',
  purchase_price: '', expense_jpy: String(FIXED_EXPENSE_JPY), tt_rate: String(DEFAULT_TT_RATE),
  /** Commercial selling amount when reserved/sold; empty for available (FOB is vehicle cost). */
  sold_price: '',
  incoterm: 'FOB' as VehicleIncoterm,
  notes: '', primary_image_url: '', source_country_code: 'JP',
  source_supplier: '',
  dealership_name: '',
  once_price: '',
  once_price_currency: 'JPY',
  shipping_port_of_loading: '',
  yard_id: '',
  location: '',
  destination_country: '',
  bid_requester_id: '',
  payment_status: 'available' as VehiclePaymentStatus,
  shipping_status: 'not_booked' as VehicleShippingStatus,
  status: 'in_stock' as Vehicle['status'],
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

const VEHICLE_FETCH_PAGE = 1000;

/**
 * Loads every matching row. The list used to stop at 250, so totals under-counted imports.
 * `includeAllProcurement`: selling roles (sales_agent / freelancer) need Cars/Machinery/Parts
 * to include third-party available units — most sellable stock is procurement_source=third_party.
 */
async function fetchInventoryVehicles(
  thirdParty: boolean,
  opts?: { includeAllProcurement?: boolean }
): Promise<{
  data: Vehicle[];
  error: { message: string } | null;
}> {
  const all: Vehicle[] = [];
  let from = 0;
  let missingProcurement = false;
  const includeAll = Boolean(opts?.includeAllProcurement);

  for (;;) {
    let query = supabase
      .from('vehicles')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(from, from + VEHICLE_FETCH_PAGE - 1);
    if (!missingProcurement && !includeAll) {
      query = thirdParty
        ? query.eq('procurement_source', 'third_party')
        : query.neq('procurement_source', 'third_party');
    }
    const res = await query;
    if (!missingProcurement && res.error && /procurement_source/i.test(res.error.message || '')) {
      missingProcurement = true;
      from = 0;
      all.length = 0;
      continue;
    }
    if (res.error) return { data: all, error: res.error };
    const raw = (res.data || []) as Vehicle[];
    const chunk =
      missingProcurement && !includeAll
        ? raw.filter((v) =>
            thirdParty
              ? isThirdPartyVehicle(v.procurement_source)
              : isOwnStockListVehicle(v.procurement_source)
          )
        : raw;
    all.push(...chunk);
    if (raw.length < VEHICLE_FETCH_PAGE) return { data: all, error: null };
    from += VEHICLE_FETCH_PAGE;
  }
}

function VehiclesPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const isThirdPartyPage = pathname === '/vehicles/third-party' || pathname.startsWith('/vehicles/third-party/');
  const listBasePath = isThirdPartyPage ? '/vehicles/third-party' : '/vehicles';
  const listCategory: StockCategory =
    searchParams.get('category') === 'machinery' || searchParams.get('category') === 'parts'
      ? (searchParams.get('category') as StockCategory)
      : 'car';
  const { profile } = useAuth();
  const {
    can,
    hasRole,
    isSellingFocused,
    isAdmin,
    canReserveStock: canReserveByPerm,
    canAssignStock,
    canSetBidRequester: canSetBidByPerm,
    canEditCourier: canEditCourierByPerm,
    canEditShipping: canEditShippingByPerm,
    canAllocateRemittances,
  } = usePermissions();
  const listCopy = isThirdPartyPage
    ? {
        title: 'Third party',
        description: 'Dealership once-price units — not auction, not our owned stock',
      }
    : isSellingFocused
      ? {
          title: LIST_TITLES[listCategory].title,
          description: 'Available stock to reserve (own and third-party), plus units you already hold',
        }
      : LIST_TITLES[listCategory];
  const canCreateVehicle = can('vehicles', 'create');
  const canEditVehicle = can('vehicles', 'edit');
  const canDeleteVehicle = can('vehicles', 'delete');
  const canHideVehicle = can('vehicles', 'edit');
  const canUnhideVehicle = isAdmin() || hasRole('manager');
  const canMakeAvailable = isAdmin();
  const canReserveStock = canReserveByPerm();
  const canEditShipping = canEditShippingByPerm();
  const canEditCourier = canEditCourierByPerm();
  const canMarkCommissionPaid = isAdmin() || hasRole('manager') || hasRole('accounts');
  const canDeallocateRemittance = canAllocateRemittances();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [vehiclePays, setVehiclePays] = useState<Record<string, VehiclePayAgg>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [saleFallback, setSaleFallback] = useState<Record<string, { agentId: string; customerId: string }>>({});
  const [vehicleInvoices, setVehicleInvoices] = useState<Record<string, VehicleInvoiceRef>>({});
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [deallocRemitTarget, setDeallocRemitTarget] = useState<VehicleRemittanceRef | null>(null);
  const [remittanceReloadToken, setRemittanceReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const paymentFilter = parsePaymentQuery(searchParams.get('payment'));
  const shippingFilter = parseShippingQuery(searchParams.get('shipping'));
  const lifecycleAlert = searchParams.get('lifecycleAlert');
  const [listFilters, setListFilters] = useState<StockListFiltersValue>(() => ({
    ...emptyListFilters(),
    search: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    customer: searchParams.get('customer') || '',
    agent: searchParams.get('agent') || '',
  }));
  const [page, setPage] = useState(() => parseStockPage(searchParams.get('page')));
  const [pageSize, setPageSize] = useState<StockPageSize>(() =>
    parseStockPageSize(searchParams.get('pageSize'))
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const [makeAvailableOpen, setMakeAvailableOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [auctionSheetFile, setAuctionSheetFile] = useState<File | null>(null);
  const [pendingPhotoZip, setPendingPhotoZip] = useState<File | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bidRequesterOpen, setBidRequesterOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [courierOpen, setCourierOpen] = useState(false);
  const [vehicleDocKinds, setVehicleDocKinds] = useState<Record<string, string[]>>({});

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    await supabase.rpc('expire_reserved_vehicles');
    // Selling roles share one catalog: available stock across own + third-party procurement.
    const sellingCatalog = isSellingFocused && !isThirdPartyPage;
    const [vRes, cRes, oRes] = await Promise.all([
      fetchInventoryVehicles(isThirdPartyPage, { includeAllProcurement: sellingCatalog }),
      supabase
        .from('customers')
        .select(
          'id, full_name, customer_code, country, city, address_line1, phone, email, default_currency, assigned_to, company_name, port_of_discharge'
        )
        .order('full_name')
        .limit(250),
      supabase.from('offices').select('*').eq('is_active', true).order('name'),
    ]);
    if (oRes.data) setOffices(oRes.data as Office[]);
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

    const [missCustRes, salesRes, itemRes, docsRes, auctionImgRes] = await Promise.all([
      missingCustomerIds.length
        ? supabase
            .from('customers')
            .select(
              'id, full_name, customer_code, country, city, address_line1, phone, email, default_currency, assigned_to, company_name, port_of_discharge'
            )
            .in('id', missingCustomerIds)
        : Promise.resolve({ data: [] as CustomerListRow[] }),
      vehicleIds.length
        ? supabase.from('sales').select('vehicle_id, customer_id, created_by, created_at').in('vehicle_id', vehicleIds).neq('status', 'cancelled')
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string; customer_id: string; created_by: string; created_at: string }> }),
      vehicleIds.length
        ? supabase.from('invoice_items').select('vehicle_id, invoice_id, created_at').in('vehicle_id', vehicleIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string | null; invoice_id: string; created_at: string }> }),
      vehicleIds.length
        ? supabase
            .from('record_attachments')
            .select('entity_id, doc_kind')
            .eq('entity_type', 'vehicles')
            .in('entity_id', vehicleIds)
            .in('doc_kind', [
              'bl',
              'amend_bl',
              'surrender',
              'waybill',
              'export_certificate',
              'export_certificate_en',
              'auction_sheet',
              'dhl',
            ])
        : Promise.resolve({ data: [] as Array<{ entity_id: string; doc_kind: string | null }> }),
      vehicleIds.length
        ? supabase
            .from('vehicle_images')
            .select('vehicle_id')
            .in('vehicle_id', vehicleIds)
            .eq('image_role', 'auction_sheet')
        : Promise.resolve({ data: [] as Array<{ vehicle_id: string }> }),
    ]);
    if (missCustRes.data?.length) customerRows = [...customerRows, ...missCustRes.data];
    setCustomers(customerRows);

    const docMap: Record<string, string[]> = {};
    for (const row of docsRes.data || []) {
      if (!row.doc_kind) continue;
      const list = docMap[row.entity_id] || (docMap[row.entity_id] = []);
      if (!list.includes(row.doc_kind)) list.push(row.doc_kind);
    }
    // ZIP A. / A_ auction sheets live on vehicle_images.image_role.
    for (const row of auctionImgRes.data || []) {
      const list = docMap[row.vehicle_id] || (docMap[row.vehicle_id] = []);
      if (!list.includes('auction_sheet')) list.push('auction_sheet');
    }
    setVehicleDocKinds(docMap);

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
      if (v.assigned_agent_id) agentIds.add(v.assigned_agent_id);
      if (v.bid_requester_id) agentIds.add(v.bid_requester_id);
      const sale = saleByVehicle.get(v.id);
      if (!v.reserved_by && !v.assigned_agent_id && sale?.created_by) agentIds.add(sale.created_by);
      if (!v.customer_id && sale?.customer_id && !customerRows.some((c) => c.id === sale.customer_id)) {
        missingCustomerIds.push(sale.customer_id);
      }
    }
    if (missingCustomerIds.length) {
      const { data: moreCust } = await supabase
        .from('customers')
        .select(
          'id, full_name, customer_code, country, city, address_line1, phone, email, default_currency, assigned_to, company_name, port_of_discharge'
        )
        .in('id', missingCustomerIds);
      if (moreCust?.length) {
        customerRows = [...customerRows, ...moreCust];
        setCustomers(customerRows);
      }
    }

    const names: Record<string, string> = {};
    const { data: allStaff } = await supabase
      .from('profiles')
      .select('id, full_name, display_name, email, is_active')
      .eq('is_active', true)
      .order('full_name')
      .limit(300);
    for (const p of (allStaff || []) as (ProfileNameRow & { is_active?: boolean })[]) {
      const label = profileDisplayName(p);
      if (label) names[p.id] = label;
    }
    // Ensure any inactive agents still on stock rows remain labeled.
    const missingAgents = [...agentIds].filter((id) => !names[id]);
    if (missingAgents.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email')
        .in('id', missingAgents);
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
        .select('id, vehicle_id, allocate_amount, payments(id, payment_code, amount, currency, status)')
        .in('vehicle_id', vehicleIds);
      if (allocRows?.length) {
        for (const a of allocRows) {
          const pay = a.payments as {
            id?: string;
            payment_code?: string;
            amount?: number;
            currency?: string;
            status?: string;
          } | null;
          const status = pay?.status;
          if (!a.vehicle_id || status === 'rejected' || !pay?.id) continue;
          const row = payMap[a.vehicle_id] || { count: 0, allocated: 0, remittances: [] };
          row.count += 1;
          const amt = Number(a.allocate_amount) || Number(pay.amount) || 0;
          if (!status || status === 'received' || status === 'reconciled' || status === 'pending') {
            row.allocated += amt;
          }
          const allocId = (a as { id?: string }).id;
          if (!row.remittances.some((r) => r.allocationId === allocId || (!allocId && r.paymentId === pay.id))) {
            row.remittances.push({
              paymentId: pay.id,
              paymentCode: pay.payment_code || pay.id.slice(0, 8),
              amount: amt,
              currency: pay.currency || 'USD',
              allocationId: allocId,
            });
          }
          payMap[a.vehicle_id] = row;
        }
      } else {
        const { data: payRows } = await supabase
          .from('payments')
          .select('id, payment_code, vehicle_id, amount, currency, status')
          .in('vehicle_id', vehicleIds);
        for (const p of payRows || []) {
          if (!p.vehicle_id || p.status === 'rejected') continue;
          const row = payMap[p.vehicle_id] || { count: 0, allocated: 0, remittances: [] };
          row.count += 1;
          const amt = Number(p.amount) || 0;
          if (p.status === 'received' || p.status === 'reconciled' || p.status === 'pending') {
            row.allocated += amt;
          }
          row.remittances.push({
            paymentId: p.id,
            paymentCode: p.payment_code || p.id.slice(0, 8),
            amount: amt,
            currency: p.currency || 'USD',
          });
          payMap[p.vehicle_id] = row;
        }
      }
    }
    setVehiclePays(payMap);
    setLoading(false);
  }, [isThirdPartyPage, isSellingFocused]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Sales agent & freelancer: default Status → Available so sellable units are front and center.
  const sellingStatusDefaulted = useRef(false);
  useEffect(() => {
    if (!isSellingFocused || sellingStatusDefaulted.current) return;
    sellingStatusDefaulted.current = true;
    if (searchParams.get('status')) return;
    setListFilters((prev) => {
      if (prev.status) return prev;
      return { ...prev, status: 'available' };
    });
  }, [isSellingFocused, searchParams]);

  const syncListQuery = useCallback(
    (next: {
      filters?: StockListFiltersValue;
      page?: number;
      pageSize?: StockPageSize;
    }) => {
      const filters = next.filters ?? listFilters;
      const nextPage = next.page ?? page;
      const nextSize = next.pageSize ?? pageSize;
      const params = new URLSearchParams();
      if (!isThirdPartyPage && listCategory !== 'car') params.set('category', listCategory);
      if (filters.search.trim()) params.set('q', filters.search.trim());
      if (filters.status) params.set('status', filters.status);
      if (filters.make) params.set('make', filters.make);
      if (filters.model) params.set('model', filters.model);
      if (filters.customer) params.set('customer', filters.customer);
      if (filters.agent) params.set('agent', filters.agent);
      if (paymentFilter) params.set('payment', paymentFilter);
      if (shippingFilter) params.set('shipping', shippingFilter);
      if (lifecycleAlert === 'shipped_unpaid' || lifecycleAlert === 'delivered_unpaid') {
        params.set('lifecycleAlert', lifecycleAlert);
      }
      if (nextPage > 1) params.set('page', String(nextPage));
      if (nextSize !== DEFAULT_STOCK_PAGE_SIZE) params.set('pageSize', String(nextSize));
      const qs = params.toString();
      router.replace(qs ? `${listBasePath}?${qs}` : listBasePath, { scroll: false });
    },
    [
      listCategory,
      listFilters,
      page,
      pageSize,
      router,
      paymentFilter,
      shippingFilter,
      lifecycleAlert,
      isThirdPartyPage,
      listBasePath,
    ]
  );

  const catalogVehicles = useMemo(() => {
    // Ops keep own vs third-party split; selling roles see both on Cars/Machinery/Parts.
    const byProc = isThirdPartyPage
      ? vehicles.filter((v) => isThirdPartyVehicle(v.procurement_source))
      : isSellingFocused
        ? vehicles
        : vehicles.filter((v) => isOwnStockListVehicle(v.procurement_source));
    if (isThirdPartyPage) return byProc;
    return byProc.filter((v) => parseStockCategory(v.stock_category) === listCategory);
  }, [vehicles, listCategory, isThirdPartyPage, isSellingFocused]);

  const filtered = useMemo(() => {
    const q = listFilters.search.trim().toLowerCase();
    const statusFilter = listFilters.status || 'all';
    const makeFilter = listFilters.make.trim().toLowerCase();
    const modelFilter = listFilters.model.trim().toLowerCase();
    return catalogVehicles.filter((v) => {
      const pay = effectivePaymentStatus(v);
      const ship = effectiveShippingStatus(v);
      const allocated = vehiclePays[v.id]?.allocated || 0;
      // Soft-hidden units stay out of default stock unless Status = Hidden.
      if (v.status === 'hidden' && statusFilter !== 'hidden') return false;
      let matchesStatus = true;
      if (statusFilter === 'available') matchesStatus = pay === 'available';
      else if (statusFilter === 'reserved') matchesStatus = pay === 'reserved';
      else if (statusFilter === 'unpaid') matchesStatus = pay === 'reserved' && allocated <= 0.009;
      else if (statusFilter === 'partial_paid') matchesStatus = pay === 'partial_paid';
      else if (statusFilter === 'paid') matchesStatus = pay === 'paid';
      else if (statusFilter === 'delivered') matchesStatus = ship === 'delivered';
      else if (statusFilter === 'hidden') matchesStatus = v.status === 'hidden';
      else if (statusFilter !== 'all') {
        matchesStatus = workflowStage(v) === statusFilter || v.status === statusFilter;
      }
      const matchesPayment = !paymentFilter || pay === paymentFilter;
      const matchesShipping = !shippingFilter || ship === shippingFilter;
      let matchesLifecycleAlert = true;
      if (lifecycleAlert === 'shipped_unpaid') {
        matchesLifecycleAlert = ship === 'shipped' && isIncompletePayment(pay);
      } else if (lifecycleAlert === 'delivered_unpaid') {
        matchesLifecycleAlert = ship === 'delivered' && isIncompletePayment(pay);
      }
      const agentId = v.reserved_by || v.assigned_agent_id || saleFallback[v.id]?.agentId || '';
      const agent = agentNames[agentId] || '';
      const bidRequester = agentNames[v.bid_requester_id || ''] || '';
      const customerId = v.customer_id || saleFallback[v.id]?.customerId || '';
      const customer = customers.find((c) => c.id === customerId)?.full_name || '';
      const invoiceCode = vehicleInvoices[v.id]?.invoice_code || '';
      const matchesSearch =
        !q ||
        [v.stock_number, v.chassis_number, v.part_sku, v.make, v.model, agent, bidRequester, customer, invoiceCode]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q));
      const matchesMake = !makeFilter || (v.make || '').trim().toLowerCase() === makeFilter;
      const matchesModel = !modelFilter || (v.model || '').trim().toLowerCase() === modelFilter;
      const matchesCustomer = !listFilters.customer || customerId === listFilters.customer;
      const matchesAgent = !listFilters.agent || agentId === listFilters.agent;
      return (
        matchesStatus &&
        matchesPayment &&
        matchesShipping &&
        matchesLifecycleAlert &&
        matchesSearch &&
        matchesMake &&
        matchesModel &&
        matchesCustomer &&
        matchesAgent
      );
    });
  }, [
    catalogVehicles,
    listFilters,
    agentNames,
    saleFallback,
    customers,
    vehicleInvoices,
    vehiclePays,
    paymentFilter,
    shippingFilter,
    lifecycleAlert,
  ]);

  const safePage = clampStockPage(page, filtered.length, pageSize);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const makeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of catalogVehicles) {
      const m = (v.make || '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [catalogVehicles]);

  const modelOptions = useMemo(() => {
    const makeFilter = listFilters.make.trim().toLowerCase();
    const set = new Set<string>();
    for (const v of catalogVehicles) {
      if (makeFilter && (v.make || '').trim().toLowerCase() !== makeFilter) continue;
      const m = (v.model || '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [catalogVehicles, listFilters.make]);

  const customerOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const v of catalogVehicles) {
      const id = v.customer_id || saleFallback[v.id]?.customerId;
      if (!id || byId.has(id)) continue;
      const name = customers.find((c) => c.id === id)?.full_name;
      if (name) byId.set(id, name);
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogVehicles, customers, saleFallback]);

  const agentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const v of catalogVehicles) {
      const id = v.reserved_by || v.assigned_agent_id || saleFallback[v.id]?.agentId;
      if (!id || byId.has(id)) continue;
      const name = agentNames[id];
      if (name) byId.set(id, name);
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogVehicles, agentNames, saleFallback]);

  const filterSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onListFiltersChange = (next: StockListFiltersValue) => {
    setListFilters(next);
    setPage(1);
    if (filterSyncTimer.current) clearTimeout(filterSyncTimer.current);
    filterSyncTimer.current = setTimeout(() => {
      syncListQuery({ filters: next, page: 1 });
    }, 250);
  };

  const onPageChange = (nextPage: number) => {
    setPage(nextPage);
    syncListQuery({ page: nextPage });
  };

  const onPageSizeChange = (nextSize: StockPageSize) => {
    setPageSize(nextSize);
    setPage(1);
    syncListQuery({ page: 1, pageSize: nextSize });
  };

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
      sold_price: v.sold_price != null ? String(Math.round(Number(v.sold_price))) : '',
      incoterm: (v.incoterm as VehicleIncoterm) || 'FOB',
      notes: stripEngineFromNotes(v.notes),
      primary_image_url: v.primary_image_url || '',
      source_country_code: v.source_country_code || resolveSourceCountry(v.source_country)?.code || 'JP',
      source_supplier: v.source_supplier || '',
      dealership_name: v.dealership_name || v.source_supplier || '',
      once_price: v.once_price != null ? String(v.once_price) : '',
      once_price_currency: (v.once_price_currency || 'JPY').toUpperCase(),
      shipping_port_of_loading: v.shipping_port_of_loading || '',
      yard_id: v.yard_id || '',
      location: v.location || '',
      destination_country: v.destination_country || '',
      bid_requester_id: v.bid_requester_id || '',
      payment_status: effectivePaymentStatus(v),
      shipping_status: effectiveShippingStatus(v),
      status: v.status,
    });
  };

  const openCreate = () => {
    setForm({
      ...emptyForm,
      stock_category: listCategory,
      stock_number: nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
    });
    setGallery([]);
    setAuctionSheetFile(null);
    setPendingPhotoZip(null);
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
    const dealership = formState.dealership_name.trim() || formState.source_supplier.trim() || null;
    const oncePriceNum = formState.once_price.trim() ? Number(formState.once_price) : null;
    const onceCurrency = (formState.once_price_currency || 'JPY').trim().toUpperCase() || 'JPY';
    const onceFob =
      isThirdPartyPage && oncePriceNum != null && Number.isFinite(oncePriceNum)
        ? fobFieldsFromOncePrice(oncePriceNum, onceCurrency, {
            expenseJpy: formState.expense_jpy === '' ? FIXED_EXPENSE_JPY : Number(formState.expense_jpy) || 0,
            ttRate: formState.tt_rate === '' ? DEFAULT_TT_RATE : Number(formState.tt_rate) || DEFAULT_TT_RATE,
          })
        : null;
    const fob = onceFob ? null : fobFromForm(formState);
    const payload: Record<string, unknown> = {
      chassis_number: chassis,
      stock_category: category,
      part_sku: formState.part_sku.trim() || (category === 'parts' ? chassis : null),
      make: formState.make.trim(),
      model: formState.model.trim(),
      color: formState.colour.trim() || null,
      model_year: formState.model_year ? Number(formState.model_year) : null,
      transmission: mapTransmissionToDb(formState.transmission),
      purchase_price: onceFob
        ? onceFob.purchase_price
        : formState.purchase_price
          ? Number(formState.purchase_price)
          : null,
      purchase_currency: onceFob?.purchase_currency || 'JPY',
      expense_jpy: onceFob
        ? onceFob.expense_jpy
        : formState.expense_jpy === ''
          ? FIXED_EXPENSE_JPY
          : Number(formState.expense_jpy) || 0,
      tt_rate: onceFob
        ? onceFob.tt_rate
        : formState.tt_rate === ''
          ? DEFAULT_TT_RATE
          : Number(formState.tt_rate) || DEFAULT_TT_RATE,
      fob_jpy: onceFob ? onceFob.fob_jpy : fob ? Math.round(fob.fobJpy) : null,
      fob_usd: onceFob ? onceFob.fob_usd : fob ? Math.round(fob.fobUsd) : null,
      listed_price: onceFob ? onceFob.listed_price : fob ? Math.round(fob.fobUsd) : null,
      listed_currency: onceFob?.listed_currency || 'USD',
      notes: mergeEngineIntoNotes(formState.notes, formState.engine),
      source_country: origin?.name || 'Japan',
      source_country_code: origin?.code || 'JP',
      source_supplier: isThirdPartyPage ? dealership : formState.source_supplier.trim() || null,
      procurement_source: isThirdPartyPage ? 'third_party' : 'own_stock',
      dealership_name: isThirdPartyPage ? dealership : null,
      once_price: isThirdPartyPage ? oncePriceNum : null,
      once_price_currency: isThirdPartyPage ? onceCurrency : 'JPY',
      shipping_port_of_loading: formState.shipping_port_of_loading.trim() || null,
      yard_id: formState.yard_id || null,
      location: formState.location.trim() || null,
      destination_country: formState.destination_country.trim() || null,
      bid_requester_id: isThirdPartyPage ? null : formState.bid_requester_id || null,
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
    if (isThirdPartyPage && (!form.dealership_name.trim() || !form.once_price.trim())) {
      toast.error('Dealership name and once price are required');
      return;
    }
    setSubmitting(true);
    const primary = pickPrimaryImageUrl(gallery);
    const insertPayload: Record<string, unknown> = {
      ...payload,
      primary_image_url: primary,
      created_by: profile.id,
      stock_number: form.stock_number.trim() || nextVehicleStockNumber(vehicles.map((v) => v.stock_number)),
      payment_status: form.payment_status,
      shipping_status: form.shipping_status,
      incoterm: form.incoterm || 'FOB',
      ...(form.status === 'on_hold' || form.status === 'archived' || form.status === 'hidden'
        ? { status: form.status }
        : {}),
    };
    let { data, error } = await supabase.from('vehicles').insert(insertPayload).select().maybeSingle();
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd|fob_jpy|yard_id|destination_country|procurement_source|dealership_name|once_price/i.test(error.message)) {
      const rest = { ...insertPayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.tt_rate;
      delete rest.fob_usd;
      delete rest.fob_jpy;
      delete rest.yard_id;
      delete rest.destination_country;
      delete rest.procurement_source;
      delete rest.dealership_name;
      delete rest.once_price;
      delete rest.once_price_currency;
      ({ data, error } = await supabase.from('vehicles').insert(rest).select().maybeSingle());
    }
    if (error) { setSubmitting(false); toast.error(error.message); return; }
    if (data && gallery.length) {
      try { await saveVehicleImages((data as Vehicle).id, gallery); } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Photos save failed');
      }
    }
    if (data && auctionSheetFile && profile) {
      const { uploadRecordAttachment } = await import('@/components/shared/record-attachments');
      await uploadRecordAttachment('vehicles', (data as Vehicle).id, auctionSheetFile, profile.id, {
        docKind: 'auction_sheet',
      });
    }
    if (data && pendingPhotoZip) {
      try {
        const zipRes = await uploadVehiclePhotoZipForId((data as Vehicle).id, pendingPhotoZip, {
          chassis_number: String(payload.chassis_number || ''),
          stock_number: String(insertPayload.stock_number || ''),
          part_sku: (payload.part_sku as string | null) || null,
        });
        if (zipRes.photos > 0) toast.success(`ZIP: ${zipRes.photos} photo(s) attached`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Photos ZIP failed');
      }
    }
    setSubmitting(false);
    toast.success(isThirdPartyPage ? 'Third-party unit added' : 'Stock added');
    setCreateOpen(false);
    setGallery([]);
    setAuctionSheetFile(null);
    setPendingPhotoZip(null);
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
    if (isThirdPartyPage && (!form.dealership_name.trim() || !form.once_price.trim())) {
      setSubmitting(false);
      toast.error('Dealership name and once price are required');
      return;
    }
    const primary = pickPrimaryImageUrl(gallery);
    // Booking/courier/customer stay on Edit Shipping / Reserve; term + vehicle cost are editable here.
    const updatePayload: Record<string, unknown> = {
      ...payload,
      primary_image_url: primary,
      stock_number: form.stock_number.trim() || selected.stock_number,
      payment_status: form.payment_status,
      shipping_status: form.shipping_status,
      incoterm: form.incoterm || 'FOB',
      updated_at: new Date().toISOString(),
    };
    // Only touch sold_price when reserved/sold — available stock keeps DB value (FOB is vehicle cost).
    if (form.payment_status !== 'available') {
      updatePayload.sold_price = form.sold_price.trim()
        ? Math.round(Number(form.sold_price))
        : null;
    }
    if (form.status === 'on_hold' || form.status === 'archived' || form.status === 'hidden') {
      updatePayload.status = form.status;
    }
    let { error } = await supabase.from('vehicles').update(updatePayload).eq('id', selected.id);
    if (error && /source_country_code|stock_category|part_sku|expense_jpy|tt_rate|fob_usd|fob_jpy|yard_id|destination_country|procurement_source|dealership_name|once_price/i.test(error.message)) {
      const rest = { ...updatePayload };
      delete rest.source_country_code;
      delete rest.stock_category;
      delete rest.part_sku;
      delete rest.expense_jpy;
      delete rest.fob_jpy;
      delete rest.yard_id;
      delete rest.destination_country;
      delete rest.tt_rate;
      delete rest.fob_usd;
      delete rest.procurement_source;
      delete rest.dealership_name;
      delete rest.once_price;
      delete rest.once_price_currency;
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

  const confirmHide = async () => {
    if (!selected) return;
    if (!canHideVehicle) {
      toast.error('You do not have permission to hide stock');
      return;
    }
    if (selected.status === 'hidden') {
      toast.message('Already hidden');
      setHideOpen(false);
      return;
    }
    setSubmitting(true);
    const fromStatus = selected.status;
    const { error } = await supabase
      .from('vehicles')
      .update({ status: 'hidden', updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (!error && profile?.id) {
      await supabase.from('vehicle_status_history').insert({
        vehicle_id: selected.id,
        from_status: fromStatus,
        to_status: 'hidden',
        note: 'Soft-hidden from stock lists and reports',
        changed_by: profile.id,
      });
    }
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Hidden from stock and reports');
    setHideOpen(false);
    setSelected(null);
    await loadVehicles();
  };

  const confirmUnhide = async (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    if (!canUnhideVehicle) {
      toast.error('Only admin or manager can unhide stock');
      return;
    }
    if (target.status !== 'hidden') {
      toast.message('Not hidden');
      return;
    }
    // Match payment/shipping so sync_vehicle_legacy_status does not force payment → available.
    const pay = effectivePaymentStatus(target);
    const ship = effectiveShippingStatus(target);
    const restoredStatus: Vehicle['status'] =
      ship === 'delivered'
        ? 'exported'
        : ship === 'shipped'
          ? 'in_transit'
          : pay === 'available'
            ? 'in_stock'
            : pay === 'paid'
              ? 'sold'
              : 'reserved';
    setSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .update({ status: restoredStatus, updated_at: new Date().toISOString() })
      .eq('id', target.id);
    if (!error && profile?.id) {
      await supabase.from('vehicle_status_history').insert({
        vehicle_id: target.id,
        from_status: 'hidden',
        to_status: restoredStatus,
        note: 'Unhidden — listing status restored from payment/shipping',
        changed_by: profile.id,
      });
    }
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Restored to stock');
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
    agentNames[v.reserved_by || v.assigned_agent_id || saleFallback[v.id]?.agentId || ''] || '';

  const rowCustomerName = (v: Vehicle) =>
    customerLabel(v.customer_id || saleFallback[v.id]?.customerId);

  const rowCustomerCountry = (v: Vehicle) => {
    const id = v.customer_id || saleFallback[v.id]?.customerId;
    const country = id ? customers.find((c) => c.id === id)?.country : null;
    return (country || '').trim();
  };

  const openAssign = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setAssignOpen(true);
  };

  const openBidRequester = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setBidRequesterOpen(true);
  };

  const handleBidRequesterSaved = ({
    vehicle: updated,
    requesterId,
    requesterName,
  }: {
    vehicle: Vehicle;
    requesterId: string | null;
    requesterName: string;
  }) => {
    setVehicles((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    setSelected((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    if (requesterId && requesterName) {
      setAgentNames((prev) => (prev[requesterId] ? prev : { ...prev, [requesterId]: requesterName }));
      toast.success(`Bid requester set to ${requesterName}`);
    } else {
      toast.success('Bid requester cleared');
    }
  };

  // Bid requester / shipping / courier are staff stock ops — not sales Actions.
  const canSetBidRequester = canSetBidByPerm();

  const handleAssigned = ({
    vehicle: updated,
    agentId,
    agentName,
  }: {
    vehicle: Vehicle;
    agentId: string;
    agentName: string;
  }) => {
    setVehicles((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    setSelected((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    setAgentNames((prev) => (prev[agentId] ? prev : { ...prev, [agentId]: agentName }));

    if (profile?.id && agentId === profile.id && canReserveStock) {
      toast.success(`Assigned to you — open reserve for ${updated.stock_number}`);
      setAssignOpen(false);
      openReserve(updated);
      return;
    }

    toast.success(`Assigned to ${agentName} — they can reserve from Cars`);
    const nextFilters: StockListFiltersValue = {
      ...emptyListFilters(),
      search: updated.stock_number,
    };
    if (filterSyncTimer.current) clearTimeout(filterSyncTimer.current);
    setListFilters(nextFilters);
    setPage(1);
    syncListQuery({ filters: nextFilters, page: 1 });
  };

  const openReserve = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    const conflict = reservationExclusivityMessage(target, profile?.id, agentNames);
    if (conflict) {
      toast.error(conflict);
      return;
    }
    setSelected(target);
    setReserveOpen(true);
  };

  const openShippingEdit = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setShippingOpen(true);
  };

  const openCourierEdit = (vehicle?: Vehicle | null) => {
    const target = vehicle || selected;
    if (!target) return;
    setSelected(target);
    setCourierOpen(true);
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

  const confirmDeallocateRemittance = async () => {
    if (!deallocRemitTarget?.allocationId) {
      toast.error('This remittance has no allocation row to remove');
      return;
    }
    if (!canDeallocateRemittance) {
      toast.error('You do not have permission to deallocate remittances');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('payment_allocations')
      .delete()
      .eq('id', deallocRemitTarget.allocationId);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not deallocate: ${error.message}`);
      return;
    }
    toast.success('Remittance removed from this vehicle — other vehicles on the TT are unchanged');
    setDeallocRemitTarget(null);
    setRemittanceReloadToken((n) => n + 1);
    await loadVehicles();
  };

  const visibleCatalog = catalogVehicles.filter((v) => v.status !== 'hidden');
  const stats = {
    total: visibleCatalog.length,
    available: visibleCatalog.filter((v) => effectivePaymentStatus(v) === 'available').length,
    reserved: visibleCatalog.filter((v) => effectivePaymentStatus(v) !== 'available').length,
  };

  const workflowFormSections = (mode: 'create' | 'edit') => {
    const fobPreview = fobFromForm(form);
    const availableVehicleCost = fobPreview ? Math.round(fobPreview.fobUsd) : null;
    const showSoldCostField = mode === 'edit' && form.payment_status !== 'available';
    return (
    <>
      <section className="space-y-1.5 rounded-xl border-2 border-[var(--jct-navy)]/25 bg-[var(--jct-panel)] p-2">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--jct-navy)]">
          Vehicle cost &amp; FOB term
        </h3>
        <p className="text-xs text-muted-foreground">
          Term and commercial cost stay at the top. Available stock uses FOB as vehicle cost; reserved/sold uses sold price.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="space-y-0.5">
            <Label>FOB term</Label>
            <Select
              value={form.incoterm}
              onValueChange={(v: VehicleIncoterm) => setForm({ ...form, incoterm: v })}
              disabled={!canEditVehicle && mode === 'edit'}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {incotermSelectOptions(form.incoterm).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label>Vehicle cost (USD)</Label>
            {showSoldCostField ? (
              <Input
                type="number"
                inputMode="decimal"
                disabled={!canEditVehicle}
                value={form.sold_price}
                onChange={(e) => setForm({ ...form, sold_price: e.target.value })}
                placeholder="Sold / quoted amount"
              />
            ) : (
              <Input
                readOnly
                disabled
                value={availableVehicleCost != null ? String(availableVehicleCost) : ''}
                placeholder="From bid formula below"
              />
            )}
          </div>
        </div>
      </section>
      <section className="space-y-1.5 rounded-xl border-2 border-primary/40 bg-primary/5 p-2">
        <h3 className="text-xs font-semibold tracking-wide text-primary">Status</h3>
        <ShippingStepper
          vehicle={{
            payment_status: form.payment_status,
            shipping_status: form.shipping_status,
            customer_id: selected?.customer_id || null,
            status: form.status,
          }}
        />
        <div className="grid gap-1.5 sm:grid-cols-3">
          <div className="space-y-0.5">
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
          <div className="space-y-0.5">
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
          <div className="space-y-0.5">
            <Label>Listing status</Label>
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
          </div>
          {selected && commissionAmountPkr(selected) != null && Number(selected.commission_pkr) > 0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
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
      {isThirdPartyPage ? (
        <section className="space-y-1.5 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-2">
          <h3 className="text-xs font-semibold tracking-wide text-amber-900">
            Dealership once price
          </h3>
          <div className="grid gap-1.5 sm:grid-cols-3">
            <div className="space-y-0.5 sm:col-span-2">
              <Label>Dealership name *</Label>
              <Input
                value={form.dealership_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dealership_name: e.target.value,
                    source_supplier: e.target.value,
                  })
                }
                placeholder="e.g. Nagoya Auto Dealer"
                disabled={!canEditVehicle && mode === 'edit'}
              />
            </div>
            <div className="space-y-0.5">
              <Label>Currency</Label>
              <Select
                value={form.once_price_currency}
                onValueChange={(v) => setForm({ ...form, once_price_currency: v })}
                disabled={!canEditVehicle && mode === 'edit'}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <Label>Once / fixed price *</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.once_price}
                onChange={(e) => setForm({ ...form, once_price: e.target.value })}
                placeholder={form.once_price_currency === 'USD' ? 'FOB USD ask' : 'Dealership ask (JPY)'}
                disabled={!canEditVehicle && mode === 'edit'}
              />
            </div>
            <div className="space-y-0.5">
              <Label>TT rate (JPY/USD)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.tt_rate}
                onChange={(e) => setForm({ ...form, tt_rate: e.target.value })}
                disabled={!canEditVehicle && mode === 'edit'}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPY once price derives FOB like stock (ask + 10% + expense ÷ TT). USD once price is stored as FOB USD.
          </p>
        </section>
      ) : (
        <FobFormulaFields
          bidJpy={form.purchase_price}
          expenseJpy={form.expense_jpy}
          ttRate={form.tt_rate}
          onChange={(patch) => setForm({ ...form, ...patch })}
          disabled={!canEditVehicle && mode === 'edit'}
        />
      )}
      <StockSourcingFields
        form={{
          source_supplier: form.source_supplier,
          shipping_port_of_loading: form.shipping_port_of_loading,
          yard_id: form.yard_id,
          location: form.location,
          destination_country: form.destination_country,
          bid_requester_id: form.bid_requester_id,
        }}
        onChange={(patch) => setForm({ ...form, ...patch })}
        staff={Object.entries(agentNames).map(([id, label]) => ({ id, label }))}
        disabled={!canEditVehicle && mode === 'edit'}
        auctionSheetFile={auctionSheetFile}
        onAuctionSheetFile={setAuctionSheetFile}
        vehicleId={mode === 'edit' ? selected?.id : null}
        profileId={profile?.id}
        onAuctionSheetUploaded={() => void loadVehicles()}
        variant={isThirdPartyPage ? 'third_party' : 'stock'}
      />
      <section className="space-y-1.5 rounded-xl border border-border/70 p-2">
        <h3 className="text-xs font-semibold">Vehicle specs</h3>
        <VehicleSpecFields form={form} onChange={(patch) => setForm({ ...form, ...patch })} showPhotos={false} />
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="space-y-0.5">
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
          <div className="space-y-0.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
      </section>
      <section className="space-y-1.5 rounded-xl border border-border/70 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold">Photos</h3>
          <VehiclePhotoZipUpload
            vehicleId={mode === 'edit' ? selected?.id || null : null}
            chassisNumber={form.chassis_number}
            stockNumber={form.stock_number}
            partSku={form.part_sku}
            pendingZip={pendingPhotoZip}
            onPendingZip={setPendingPhotoZip}
            onGalleryReload={setGallery}
            disabled={!canEditVehicle && mode === 'edit'}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          ZIP folder = chassis/stock/SKU (e.g. <code>RU3-123123/</code>). Files: <code>A.</code>/<code>A_</code> auction (ERP only),
          {' '}<code>F.</code> front, <code>B.</code> back.
        </p>
        <MultiImageUpload
          folder={chassisStorageFolder(form.chassis_number || form.part_sku || form.stock_number)}
          images={gallery}
          onChange={setGallery}
          label="Gallery"
        />
      </section>
    </>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={listCopy.title} description={listCopy.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isThirdPartyPage ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/bulk-upload?kind=third_party">Bulk import</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href="/vehicles/lifecycle">Stock pipeline</Link>
              </Button>
            )}
            {canCreateVehicle ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                {isThirdPartyPage ? 'Add third-party unit' : 'Add stock'}
              </Button>
            ) : null}
          </div>
        } />

      {paymentFilter || shippingFilter || lifecycleAlert ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pipeline filter:</span>
          {paymentFilter ? <Badge variant="outline">{PAYMENT_STATUS_LABELS[paymentFilter]}</Badge> : null}
          {shippingFilter ? <Badge variant="outline">{SHIPPING_STATUS_LABELS[shippingFilter]}</Badge> : null}
          {lifecycleAlert === 'shipped_unpaid' ? <Badge variant="outline">En route unpaid</Badge> : null}
          {lifecycleAlert === 'delivered_unpaid' ? <Badge variant="outline">Landed unpaid</Badge> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              const params = new URLSearchParams();
              if (!isThirdPartyPage && listCategory !== 'car') params.set('category', listCategory);
              if (listFilters.search.trim()) params.set('q', listFilters.search.trim());
              if (listFilters.status) params.set('status', listFilters.status);
              if (listFilters.make) params.set('make', listFilters.make);
              if (listFilters.model) params.set('model', listFilters.model);
              if (listFilters.customer) params.set('customer', listFilters.customer);
              if (listFilters.agent) params.set('agent', listFilters.agent);
              const qs = params.toString();
              router.replace(qs ? `${listBasePath}?${qs}` : listBasePath, { scroll: false });
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { l: 'Total', v: stats.total, tone: 'erp-stat-card--navy' },
            { l: 'Available', v: stats.available, tone: 'erp-stat-card--success' },
            { l: 'Reserved', v: stats.reserved, tone: 'erp-stat-card--gold' },
          ] as const
        ).map((s) => (
          <Card key={s.l} className={`erp-stat-card ${s.tone} rounded-md shadow-sm`}>
            <CardContent className="p-3.5 sm:p-4">
              <p className="erp-stat-label">{s.l}</p>
              <p className="erp-stat-value">{s.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <StockListFilters
        total={filtered.length}
        value={listFilters}
        onChange={onListFiltersChange}
        statusOptions={STOCK_STATUS_OPTIONS}
        makeOptions={makeOptions}
        modelOptions={modelOptions}
        customerOptions={customerOptions}
        agentOptions={agentOptions}
        searchPlaceholder="Search stock ID, chassis, make…"
      />

      {loading ? (
        <Card><div className="flex justify-center p-12"><Loader2 className="h-4 w-4 animate-spin" /></div></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <ErpEmptyState
            icon={CarFront}
            title={`No ${listCopy.title.toLowerCase()} in this list yet`}
            description={
              isSellingFocused
                ? 'Available stock (own and third-party) plus units you reserved. Clear Status or pick All if this filter is empty. Other agents’ reserved units stay hidden.'
                : isThirdPartyPage
                  ? 'Add a dealership once-price unit or import via Bulk upload → Third party.'
                  : 'Add stock or adjust your filters.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            {paged.map((v) => {
              const pay = effectivePaymentStatus(v);
              const pays = vehiclePays[v.id];
              return (
                <StockListCard
                  key={v.id}
                  vehicle={v}
                  customerName={rowCustomerName(v)}
                  customerCountry={rowCustomerCountry(v)}
                  agentName={rowAgentName(v)}
                  bidRequesterName={
                    v.bid_requester_id ? agentNames[v.bid_requester_id] || 'Agent' : ''
                  }
                  invoice={vehicleInvoices[v.id] || null}
                  paymentCount={pays?.count || 0}
                  allocatedUsd={pays?.allocated || 0}
                  remittances={pays?.remittances || []}
                  docKinds={vehicleDocKinds[v.id] || []}
                  canDeallocateRemittance={canDeallocateRemittance}
                  onDeallocateRemittance={
                    canDeallocateRemittance ? (row) => setDeallocRemitTarget(row) : undefined
                  }
                  onViewInfo={() => setSelected(v)}
                  onEdit={canEditVehicle ? () => { void openEdit(v); } : undefined}
                  onAssign={canAssignStock() && pay === 'available' ? () => openAssign(v) : undefined}
                  onSetBidRequester={canSetBidRequester ? () => openBidRequester(v) : undefined}
                  onReserve={canReserveStock && pay === 'available' ? () => openReserve(v) : undefined}
                  onMakeAvailable={
                    canMakeAvailable && vehicleCanMakeAvailable(v)
                      ? () => openMakeAvailable(v)
                      : undefined
                  }
                  onShipping={canEditShipping ? () => openShippingEdit(v) : undefined}
                  onCourier={canEditCourier ? () => openCourierEdit(v) : undefined}
                  onDelete={canDeleteVehicle ? () => { setSelected(v); setDeleteOpen(true); } : undefined}
                  onHide={
                    canHideVehicle && v.status !== 'hidden'
                      ? () => {
                          setSelected(v);
                          setHideOpen(true);
                        }
                      : undefined
                  }
                  onUnhide={
                    canUnhideVehicle && v.status === 'hidden'
                      ? () => {
                          void confirmUnhide(v);
                        }
                      : undefined
                  }
                  onMarkCommissionPaid={
                    canMarkCommissionPaid && effectiveCommissionStatus(v) === 'due'
                      ? () => { void markCommissionPaid(v.id); }
                      : undefined
                  }
                />
              );
            })}
          </div>
          <StockListPagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent fullscreen>
        <DialogHeader>
          <DialogTitle>
            {isThirdPartyPage ? 'Add third-party unit' : `Add ${stockCategoryLabel(listCategory).toLowerCase()}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitCreate} className="space-y-3">
          {workflowFormSections('create')}
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent fullscreen>
        <DialogHeader>
          <DialogTitle>{isThirdPartyPage ? 'Edit third-party unit' : 'Edit stock'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitEdit} className="space-y-3">
          {workflowFormSections('edit')}
          <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <VehicleViewInfoDialog
        open={
          !!selected &&
          !editOpen &&
          !deleteOpen &&
          !hideOpen &&
          !reserveOpen &&
          !assignOpen &&
          !bidRequesterOpen &&
          !shippingOpen &&
          !courierOpen &&
          !makeAvailableOpen
        }
        onOpenChange={(o) => !o && setSelected(null)}
        vehicle={selected}
        agentName={selected ? rowAgentName(selected) : ''}
        customerName={selected ? rowCustomerName(selected) : ''}
        customers={customers}
        statusLabels={statusLabels}
        canReserveStock={canReserveStock}
        canEditVehicle={canEditVehicle}
        canEditShipping={canEditShipping}
        canDeleteVehicle={canDeleteVehicle}
        canHideVehicle={canHideVehicle}
        canUnhideVehicle={canUnhideVehicle}
        canMarkCommissionPaid={canMarkCommissionPaid}
        canDeallocateRemittance={canDeallocateRemittance}
        submitting={submitting}
        onReserve={() => openReserve()}
        onEdit={() => {
          void openEdit();
        }}
        onBooking={() => openShippingEdit()}
        onDelete={() => setDeleteOpen(true)}
        onHide={() => setHideOpen(true)}
        onUnhide={() => {
          void confirmUnhide();
        }}
        onMarkCommissionPaid={() => {
          if (selected) void markCommissionPaid(selected.id);
        }}
        onDeallocateRemittance={
          canDeallocateRemittance ? (row) => setDeallocRemitTarget(row) : undefined
        }
        onDocsChanged={() => {
          void loadVehicles();
        }}
        remittanceReloadToken={remittanceReloadToken}
      />

      <AssignStockDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        vehicle={selected}
        currentUserId={profile?.id}
        onAssigned={handleAssigned}
      />

      <SetBidRequesterDialog
        open={bidRequesterOpen}
        onOpenChange={setBidRequesterOpen}
        vehicle={selected}
        onSaved={handleBidRequesterSaved}
      />

      <ReserveVehicleDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        vehicle={selected}
        customers={
          isSellingFocused && profile?.id
            ? customers.filter((c) => !c.assigned_to || c.assigned_to === profile.id)
            : customers
        }
        offices={offices}
        agentNames={agentNames}
        onSaved={() => loadVehicles()}
      />
      <EditShippingDialog
        open={shippingOpen}
        onOpenChange={setShippingOpen}
        vehicle={selected}
        onSaved={() => loadVehicles()}
      />
      <EditCourierDialog
        open={courierOpen}
        onOpenChange={setCourierOpen}
        vehicle={selected}
        onSaved={() => loadVehicles()}
      />

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete vehicle?" description="Removes available stock only. Reserved or invoiced units are blocked." confirmLabel="Delete" destructive loading={submitting} onConfirm={confirmDelete} />
      <ConfirmDialog
        open={hideOpen}
        onOpenChange={setHideOpen}
        title="Hide vehicle from stock?"
        description="Soft-hides this unit: it stays in the database but drops out of default stock lists and report aggregates. Use Status → Hidden to find it again. Admin or manager can unhide."
        confirmLabel="Hide"
        loading={submitting}
        onConfirm={confirmHide}
      />
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
      <ConfirmDialog
        open={Boolean(deallocRemitTarget)}
        onOpenChange={(open) => !open && setDeallocRemitTarget(null)}
        title="Deallocate remittance from this vehicle?"
        description={
          deallocRemitTarget
            ? `Removes ${deallocRemitTarget.paymentCode} (${deallocRemitTarget.currency} ${deallocRemitTarget.amount.toLocaleString()}) from this stock only. Other vehicles on the same TT keep their allocations; payment status is recomputed.`
            : ''
        }
        confirmLabel="Deallocate"
        destructive
        loading={submitting}
        onConfirm={confirmDeallocateRemittance}
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
