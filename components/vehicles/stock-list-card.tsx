'use client';

import Link from 'next/link';
import { AlertTriangle, CarFront, Check, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VehicleDocChip } from '@/components/vehicles/vehicle-doc-chip';
import { invoiceOpenHrefByCode } from '@/lib/invoice-links';
import {
  VehicleRemittancePopover,
  VehicleTtChip,
  type VehicleRemittanceRef,
} from '@/components/vehicles/vehicle-remittance-popover';
import { resolveSourceCountry } from '@/lib/source-countries';
import type { Vehicle } from '@/lib/types';
import { CURRENCY_SYMBOLS, normalizeCurrency } from '@/lib/utils/currencies';
import { cn } from '@/lib/utils';
import { publicEngineFromNotes } from '@/lib/public/vehicles';
import { calcFobFromBid, BID_MARKUP_RATE, DEFAULT_TT_RATE, FIXED_EXPENSE_JPY } from '@/lib/utils/vehicle-pricing';
import {
  commissionAmountPkr,
  effectiveCommissionStatus,
  effectivePaymentStatus,
  effectiveShippingStatus,
  freightModeListLabel,
  PAYMENT_STATUS_PILL_LABELS,
  PAYMENT_STATUS_PILL_STYLES,
  SHIPPING_STATUS_SHORT,
  soldProfitUsd,
  vehicleCommissionDueClass,
  vehicleListRowClass,
  publicFobUsd,
} from '@/lib/vehicle-lifecycle';

const AGENT_DOTS = ['bg-sky-500', 'bg-lime-500', 'bg-violet-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];

function agentDotClass(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * (i + 1)) % AGENT_DOTS.length;
  return AGENT_DOTS[h];
}

function listMoney(value: number, currency: string) {
  const n = Number(value);
  const safe = Math.round(Number.isFinite(n) ? n : 0);
  const code = normalizeCurrency(currency);
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function isoDate(value: string | null | undefined) {
  if (!value) return '';
  const day = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (day) return day[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function fuelChip(fuel: Vehicle['fuel_type']) {
  if (fuel === 'petrol') return 'GASOLINE';
  if (fuel === 'diesel') return 'DIESEL';
  if (fuel === 'hybrid') return 'HYBRID';
  if (fuel === 'electric') return 'ELECTRIC';
  if (fuel === 'other') return 'OTHER';
  return '';
}

function transmissionChip(t: Vehicle['transmission']) {
  if (t === 'automatic') return 'AT';
  if (t === 'manual') return 'MT';
  if (t === 'cvt') return 'CVT';
  if (t === 'other') return 'OTHER';
  return '';
}

function engineChip(notes: string | null) {
  const raw = publicEngineFromNotes(notes)?.trim();
  if (!raw) return '';
  if (/cc/i.test(raw)) return raw.replace(/\s+/g, '');
  const n = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(n) && n >= 100) return `${Math.round(n).toLocaleString()}cc`;
  return raw;
}

function specChips(v: Vehicle) {
  const chips: string[] = [];
  const fuel = fuelChip(v.fuel_type);
  const trans = transmissionChip(v.transmission);
  const cc = engineChip(v.notes);
  const color = (v.color || '').trim().toUpperCase();
  if (fuel) chips.push(fuel);
  if (trans) chips.push(trans);
  if (cc) chips.push(cc);
  if (color) chips.push(color);
  if (v.part_sku) chips.push(v.part_sku);
  return chips;
}

function sourcePlace(v: Vehicle) {
  const country = (v.source_country || resolveSourceCountry(v.source_country_code)?.name || '').toUpperCase();
  const pol = (v.shipping_port_of_loading || '').trim();
  if (pol) {
    const parts = pol.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { city: parts[0].toUpperCase(), country: parts.slice(1).join(' ').toUpperCase() };
    }
    return { city: pol.toUpperCase(), country };
  }
  return { city: '', country };
}

export type StockListCardProps = {
  vehicle: Vehicle;
  customerName: string;
  customerCountry: string;
  agentName: string;
  /** Display name for vehicles.bid_requester_id (BID pill). */
  bidRequesterName?: string;
  invoice: { id: string; invoice_code: string } | null;
  paymentCount: number;
  allocatedUsd: number;
  remittances?: VehicleRemittanceRef[];
  /** Doc kinds present for this vehicle (e.g. bl, export_certificate). */
  docKinds?: string[];
  /** Per-vehicle remittance deallocate (admin/manager/accounts). */
  canDeallocateRemittance?: boolean;
  onDeallocateRemittance?: (row: VehicleRemittanceRef) => void;
  onViewInfo: () => void;
  onEdit?: () => void;
  onAssign?: () => void;
  onSetBidRequester?: () => void;
  onReserve?: () => void;
  onMakeAvailable?: () => void;
  onShipping?: () => void;
  onCourier?: () => void;
  onDelete?: () => void;
  onMarkCommissionPaid?: () => void;
};

type StockListCardActionsMenuProps = Pick<
  StockListCardProps,
  | 'invoice'
  | 'onEdit'
  | 'onAssign'
  | 'onSetBidRequester'
  | 'onViewInfo'
  | 'onReserve'
  | 'onMakeAvailable'
  | 'onShipping'
  | 'onCourier'
  | 'onDelete'
  | 'onMarkCommissionPaid'
>;

/** Fixed right-rail control chrome — same width/height so Edit shipping / Actions / View Info align. */
const RAIL_BTN =
  'h-9 min-h-9 w-full shrink-0 justify-center rounded-lg px-3 text-[12px] font-semibold shadow-sm';
const RAIL_BRAND_BTN = cn(
  RAIL_BTN,
  'bg-brand text-brand-foreground hover:bg-brand/90 focus-visible:ring-brand/40'
);
const RAIL_OUTLINE_BTN = cn(
  RAIL_BTN,
  'justify-between border border-slate-300/80 bg-white/90 text-slate-900 shadow-glass-sm backdrop-blur-md',
  'hover:border-brand/45 hover:bg-white hover:text-slate-950'
);

function StockListCardActionsMenu({
  invoice,
  onEdit,
  onAssign,
  onSetBidRequester,
  onViewInfo,
  onReserve,
  onMakeAvailable,
  onShipping,
  onCourier,
  onDelete,
  onMarkCommissionPaid,
}: StockListCardActionsMenuProps) {
  return (
    <>
      {onEdit || onAssign || onSetBidRequester || onViewInfo ? (
        <>
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Stock
          </DropdownMenuLabel>
          {onEdit ? <DropdownMenuItem onSelect={onEdit}>Edit Stock Details</DropdownMenuItem> : null}
          {onAssign ? <DropdownMenuItem onSelect={onAssign}>Assign Stock</DropdownMenuItem> : null}
          {onSetBidRequester ? (
            <DropdownMenuItem onSelect={onSetBidRequester}>Set Bid Requester</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onViewInfo}>View Stock Details</DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem onSelect={onViewInfo}>View Stock Details</DropdownMenuItem>
      )}
      {onReserve ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sale &amp; Invoice
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={onReserve}>Reserve Vehicle</DropdownMenuItem>
        </>
      ) : null}
      {onShipping || onCourier ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Shipping
          </DropdownMenuLabel>
          {onCourier ? <DropdownMenuItem onSelect={onCourier}>Edit Courier Info</DropdownMenuItem> : null}
          {onShipping ? <DropdownMenuItem onSelect={onShipping}>Edit Shipping Info</DropdownMenuItem> : null}
        </>
      ) : null}
      {onMarkCommissionPaid || invoice ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Money
          </DropdownMenuLabel>
          {onMarkCommissionPaid ? (
            <DropdownMenuItem onSelect={onMarkCommissionPaid}>Mark commission paid</DropdownMenuItem>
          ) : null}
          {invoice ? (
            <DropdownMenuItem asChild>
              <Link href={invoiceOpenHrefByCode(invoice)}>Open invoice</Link>
            </DropdownMenuItem>
          ) : null}
        </>
      ) : null}
      {onMakeAvailable || onDelete ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Danger
          </DropdownMenuLabel>
          {onMakeAvailable ? (
            <DropdownMenuItem onSelect={onMakeAvailable}>Make available</DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Always opens downward with internal scroll — never collision-flipped over the card. */
function StockListCardActionsDropdown(props: StockListCardActionsMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={RAIL_OUTLINE_BTN}
          onClick={(e) => e.stopPropagation()}
        >
          <span>Actions</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        avoidCollisions={false}
        className="z-[80] w-56 max-h-72 overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <StockListCardActionsMenu {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StockListCard({
  vehicle: v,
  customerName,
  customerCountry,
  agentName,
  bidRequesterName = '',
  invoice,
  paymentCount,
  allocatedUsd,
  remittances = [],
  docKinds = [],
  canDeallocateRemittance = false,
  onDeallocateRemittance,
  onViewInfo,
  onEdit,
  onAssign,
  onSetBidRequester,
  onReserve,
  onMakeAvailable,
  onShipping,
  onCourier,
  onDelete,
  onMarkCommissionPaid,
}: StockListCardProps) {
  const pay = effectivePaymentStatus(v);
  const ship = effectiveShippingStatus(v);
  const place = sourcePlace(v);
  const bid = v.purchase_price != null ? Number(v.purchase_price) : null;
  const expense = v.expense_jpy == null ? FIXED_EXPENSE_JPY : Number(v.expense_jpy) || 0;
  const tt = v.tt_rate == null ? DEFAULT_TT_RATE : Number(v.tt_rate) || DEFAULT_TT_RATE;
  const fobCalc = bid != null ? calcFobFromBid(bid, expense, tt) : null;
  const buyJpy = fobCalc && bid != null && Math.round(fobCalc.fobJpy) !== Math.round(bid) ? fobCalc.fobJpy : null;
  const fobUsd = publicFobUsd(v);
  const listed = v.listed_price != null ? Number(v.listed_price) : null;
  const showWeb = listed != null && (fobUsd == null || Math.abs(listed - Number(fobUsd)) > 0.5);
  const sold = v.sold_price != null ? Number(v.sold_price) : null;
  const reservedOrSold = pay !== 'available' || sold != null;
  /** Commercial vehicle cost: sold/quoted amount when reserved/sold; otherwise FOB/listed. */
  const vehicleCost =
    reservedOrSold && sold != null
      ? sold
      : fobUsd != null
        ? Number(fobUsd)
        : listed != null
          ? listed
          : null;
  const showFobBesideCost =
    fobUsd != null &&
    (vehicleCost == null || Math.abs(Number(fobUsd) - vehicleCost) > 0.5);
  const profit = soldProfitUsd(v);
  const due = sold != null ? Math.max(0, sold - allocatedUsd) : null;
  const duePct = sold != null && sold > 0 && due != null ? Math.round((due / sold) * 1000) / 10 : null;
  const paidInFull = pay === 'paid' || (due != null && due <= 0.009 && sold != null && sold > 0);
  const incoterm = v.incoterm || '';
  const freight = freightModeListLabel(v.freight_mode);
  const cfNoFreight = (incoterm === 'C&F' || incoterm === 'CIF') && !v.freight_mode;
  const noBankRate = v.tt_rate == null;
  const commAmt = commissionAmountPkr(v);
  const commStatus = effectiveCommissionStatus(v);
  const chips = specChips(v);
  const title = [v.make, v.model, v.model_year].filter(Boolean).join(' ').toUpperCase();
  const dateLabel = isoDate(v.arrival_date) || isoDate(v.updated_at);
  const purchaseCcy = v.purchase_currency || 'JPY';
  const soldCcy = v.listed_currency || 'USD';
  const markupPct = Math.round(BID_MARKUP_RATE * 100);
  const showMoney = pay !== 'available' || sold != null || Boolean(customerName);
  const hasActions = Boolean(
    onEdit ||
      onAssign ||
      onSetBidRequester ||
      onReserve ||
      onMakeAvailable ||
      onShipping ||
      onCourier ||
      onDelete ||
      onMarkCommissionPaid ||
      invoice
  );
  const remitList = remittances.length ? remittances : [];
  const showRemittance = remitList.length > 0 || paymentCount > 0;
  const hasBl = docKinds.includes('bl');
  const hasAbl = docKinds.includes('amend_bl');
  const hasEc = docKinds.includes('export_certificate');
  const hasEec = docKinds.includes('export_certificate_en');
  const hasSd = docKinds.includes('surrender') || docKinds.includes('waybill');
  const hasDhl = docKinds.includes('dhl');
  const hasAuctionSheet = docKinds.includes('auction_sheet');
  const hasDocChips =
    hasBl || hasAbl || hasEc || hasEec || hasSd || hasDhl || invoice || remitList.length > 0;
  const etd = isoDate(v.shipping_etd);
  const eta = isoDate(v.shipping_eta);
  const etdEtaLine = etd || eta ? `ETD ${etd || '—'} · ETA ${eta || '—'}` : '';
  const containerLabel = (v.shipping_container_number || '').trim();

  const statusAria = [
    PAYMENT_STATUS_PILL_LABELS[pay],
    incoterm || null,
    SHIPPING_STATUS_SHORT[ship],
    freight || null,
    vehicleCost != null ? `Vehicle cost ${listMoney(vehicleCost, soldCcy)}` : null,
    commStatus === 'due' ? 'Commission due' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      role="article"
      aria-label={`${v.stock_number || 'Vehicle'}: ${statusAria}`}
      className={cn(
        'overflow-visible rounded-xl border py-4 pl-4 pr-5 sm:py-5 sm:pl-5 sm:pr-6',
        vehicleListRowClass(v),
        vehicleCommissionDueClass(v)
      )}
    >
      {/*
        Below xl: stacked sections (no overlapping flex columns).
        xl+: fixed-width actions rail (12.5rem) so money/chips never collide with buttons.
      */}
      <div
        className={cn(
          'grid w-full items-start gap-x-5 gap-y-4 overflow-visible sm:gap-x-6 sm:gap-y-5',
          'grid-cols-1',
          'md:grid-cols-[auto_minmax(12rem,1.2fr)_minmax(7.5rem,0.7fr)_minmax(8rem,0.8fr)]',
          showMoney
            ? 'xl:grid-cols-[auto_minmax(10.5rem,1.1fr)_minmax(6.5rem,0.6fr)_minmax(7.5rem,0.7fr)_minmax(12.5rem,1.1fr)_12.5rem]'
            : 'xl:grid-cols-[auto_minmax(10.5rem,1.1fr)_minmax(6.5rem,0.6fr)_minmax(7.5rem,0.7fr)_12.5rem]'
        )}
      >
        {/* Thumb */}
        <div className="shrink-0 pt-0.5">
          <div className="h-[88px] w-[120px] overflow-hidden rounded-md bg-white/80 ring-1 ring-black/10 sm:h-[100px] sm:w-[140px]">
            {v.primary_image_url ? (
              <img src={v.primary_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <CarFront className="h-8 w-8" />
              </div>
            )}
          </div>
        </div>

        {/* Vehicle identity */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-bold leading-tight tracking-tight text-sky-800">{v.stock_number}</p>
            {incoterm ? (
              <span className="inline-flex rounded-md bg-lime-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-lime-800 ring-1 ring-lime-300/80">
                {incoterm}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] font-bold uppercase leading-snug text-slate-900">{title || '—'}</p>
          {v.model_grade ? <p className="text-[12px] leading-snug text-slate-700">{v.model_grade}</p> : null}
          {chips.length ? (
            <p className="mt-0.5 text-xs uppercase leading-snug tracking-wide text-slate-600">{chips.join(' · ')}</p>
          ) : null}
          {v.chassis_number ? (
            <span className="mt-1.5 inline-flex rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold tracking-wide text-white">
              {v.chassis_number}
            </span>
          ) : null}
          {hasAuctionSheet ? (
            <div className="mt-1.5">
              <VehicleDocChip
                entityId={v.id}
                label="Auction sheet"
                docKinds={['auction_sheet']}
                className="h-7 border border-sky-300 bg-white px-2.5 font-semibold normal-case tracking-normal text-sky-800 hover:bg-sky-50"
              />
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {cfNoFreight ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                <AlertTriangle className="h-3 w-3" /> C&amp;F no freight
              </span>
            ) : null}
            {noBankRate ? (
              <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                No bank rate
              </span>
            ) : null}
          </div>
          {containerLabel ? (
            <p className="mt-1.5 text-xs font-semibold text-slate-600">Container {containerLabel}</p>
          ) : null}
        </div>

        {/* Origin / pricing cues — Vehicle cost + term lead; bid/buy secondary */}
        <div className="min-w-0 text-[12px] leading-5">
          {place.city || place.country ? (
            <p className="font-semibold uppercase tracking-wide text-slate-800">
              {place.city ? `${place.city}${place.country ? ', ' : ''}` : ''}
              {place.country ? <span className="text-sky-700">{place.country}</span> : null}
            </p>
          ) : null}
          {v.location ? <p className="text-slate-600">{v.location}</p> : null}
          {dateLabel ? <p className="text-slate-500">{dateLabel}</p> : null}
          {vehicleCost != null ? (
            <p className="mt-0.5">
              <span className="text-xs font-bold uppercase tracking-wide text-sky-700">Vehicle cost </span>
              <span className="text-[13px] font-bold text-slate-950">{listMoney(vehicleCost, soldCcy)}</span>
            </p>
          ) : null}
          {bid != null ? (
            <p>
              <span className="text-xs font-semibold uppercase text-slate-500">Bid </span>
              <span className="font-semibold text-rose-700">{listMoney(bid, purchaseCcy)}</span>
            </p>
          ) : null}
          {buyJpy != null ? (
            <p>
              <span className="text-xs font-semibold uppercase text-slate-500">Buy </span>
              <span className="font-semibold text-slate-800">{listMoney(buyJpy, 'JPY')}</span>
            </p>
          ) : null}
          {showFobBesideCost ? (
            <p>
              <span className="text-xs font-semibold uppercase text-slate-500">FOB </span>
              <span className="font-semibold text-slate-800">{listMoney(Number(fobUsd), soldCcy)}</span>
            </p>
          ) : null}
          {showWeb && listed != null ? (
            <p>
              <span className="text-xs font-semibold uppercase text-slate-500">Web </span>
              <span className="font-semibold">{listMoney(listed, v.listed_currency || 'USD')}</span>
            </p>
          ) : null}
        </div>

        {/* Customer / agent */}
        <div className="min-w-0 text-[12px] leading-5">
          {customerName ? (
            <p>
              <span className="font-bold uppercase text-sky-800">{customerName}</span>
              {customerCountry ? <span className="ml-1 font-semibold uppercase text-slate-500">{customerCountry}</span> : null}
            </p>
          ) : pay !== 'available' ? (
            <p className="font-semibold text-slate-500">No customer</p>
          ) : null}
          {agentName ? (
            <p className="flex items-center gap-1.5 text-slate-700">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', agentDotClass(agentName))} />
              {agentName}
            </p>
          ) : null}
          {bidRequesterName ? (
            <p className="mt-1">
              <span className="inline-flex max-w-full items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-900">
                <span className="truncate">BID {bidRequesterName}</span>
              </span>
            </p>
          ) : null}
          {v.source_supplier ? <p className="uppercase text-slate-500">{v.source_supplier}</p> : null}
        </div>

        {/* Money boxes — wrap inside this column only; never spill into the actions rail */}
        {showMoney ? (
          <div className="min-w-0 max-w-full space-y-1.5 md:col-span-4 xl:col-span-1 xl:pr-1">
            <div className="flex flex-wrap gap-1.5">
              <div className="min-w-[6.5rem] flex-1 basis-[6.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Sold</p>
                <p className="text-[13px] font-bold leading-tight whitespace-nowrap">
                  {sold != null ? listMoney(sold, soldCcy) : '—'}
                </p>
              </div>
              <div className="min-w-[7.5rem] flex-1 basis-[7.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Balance</p>
                <p
                  className={cn(
                    'text-[13px] font-bold leading-tight whitespace-nowrap',
                    paidInFull ? 'text-emerald-700' : 'text-red-600'
                  )}
                >
                  {due != null ? listMoney(due, soldCcy) : '—'}
                </p>
                {paidInFull ? (
                  <p className="flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-emerald-700">
                    <Check className="h-3 w-3 shrink-0" /> Paid in full
                  </p>
                ) : duePct != null ? (
                  <p className="whitespace-nowrap text-xs font-semibold text-red-600">{duePct}% due</p>
                ) : null}
              </div>
              <div className="min-w-[6.5rem] flex-1 basis-[6.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Profit (ex freight)</p>
                <p className="text-[13px] font-bold leading-tight whitespace-nowrap text-emerald-800">
                  {profit != null ? listMoney(profit, soldCcy) : '—'}
                </p>
                {v.tt_rate != null ? (
                  <p className="whitespace-nowrap text-xs text-slate-500">@{Number(v.tt_rate)} TT</p>
                ) : null}
                <p className="whitespace-nowrap text-xs font-semibold text-fuchsia-700">JP {markupPct}%</p>
                {commAmt != null && commAmt > 0 ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-700">
                    <span className="whitespace-nowrap">Comm {listMoney(commAmt, 'PKR')}</span>
                    {commStatus === 'paid' ? (
                      <span className="rounded-full bg-emerald-600 px-1 text-xs uppercase text-white">Paid</span>
                    ) : commStatus === 'due' ? (
                      <span className="rounded-full bg-fuchsia-100 px-1 text-xs uppercase text-fuchsia-900">Due</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            {cfNoFreight ? (
              <p className="flex items-center gap-1 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> C&amp;F but NO Freight!
              </p>
            ) : null}
            {showRemittance && remitList.length ? (
              <VehicleRemittancePopover
                remittances={remitList}
                allocatedLabel={listMoney(allocatedUsd, soldCcy)}
                canDeallocate={canDeallocateRemittance}
                onDeallocate={onDeallocateRemittance}
              />
            ) : null}
            {(hasDocChips || etdEtaLine) ? (
              <div className="space-y-1 pt-0.5">
                {hasDocChips ? (
                  <div className="flex max-w-full flex-wrap items-center gap-1.5">
                    {hasBl ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="BL"
                        docKinds={['bl']}
                        className="bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-600/40"
                      />
                    ) : null}
                    {hasEc ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="EC"
                        docKinds={['export_certificate']}
                        className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600/40"
                      />
                    ) : null}
                    {hasEec ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="EEC"
                        docKinds={['export_certificate_en']}
                        className="bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-600/40"
                      />
                    ) : null}
                    {hasAbl ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="ABL"
                        docKinds={['amend_bl']}
                        className="bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-700/40"
                      />
                    ) : null}
                    {hasSd ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="SD"
                        docKinds={['surrender', 'waybill']}
                        className="bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-600/40"
                      />
                    ) : null}
                    {hasDhl ? (
                      <VehicleDocChip
                        entityId={v.id}
                        label="DHL"
                        docKinds={['dhl']}
                        icon={<FileText className="h-3 w-3 shrink-0 text-rose-500" aria-hidden />}
                        className="h-6 gap-1 rounded-full border border-slate-600 bg-slate-900 px-2 text-white hover:bg-slate-800 focus-visible:ring-slate-500/40"
                      />
                    ) : null}
                    {remitList.length ? (
                      // One TT chip per remittance (screenshot shows TT × N)
                      remitList.slice(0, 5).map((r) => (
                        <VehicleTtChip key={r.paymentId} remittances={[r]} />
                      ))
                    ) : null}
                    {invoice ? (
                      <VehicleDocChip
                        entityType="invoices"
                        entityId={invoice.id}
                        label="INV"
                        className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600/40"
                        preferHref
                        fallbackHref={invoiceOpenHrefByCode(invoice)}
                        emptyMessage={`No file on ${invoice.invoice_code}`}
                      />
                    ) : null}
                  </div>
                ) : null}
                {etdEtaLine ? (
                  <p className="text-xs font-medium text-slate-500">{etdEtaLine}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Right rail — isolated column: status → shipping → controls (never shrinks under money/chips) */}
        <aside
          className={cn(
            'flex w-full flex-col items-stretch',
            'md:col-span-4',
            'xl:col-span-1 xl:w-[12.5rem] xl:min-w-[12.5rem] xl:max-w-[12.5rem] xl:shrink-0',
            'xl:border-l xl:border-black/10 xl:pl-4'
          )}
        >
          <div className="flex flex-col items-stretch gap-1.5">
            <span
              role="status"
              className={cn(
                'inline-flex w-full items-center justify-center px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm',
                pay === 'available' ? 'rounded-full' : 'rounded-md',
                PAYMENT_STATUS_PILL_STYLES[pay]
              )}
            >
              {PAYMENT_STATUS_PILL_LABELS[pay]}
            </span>
            {incoterm ? (
              <span className="inline-flex w-full items-center justify-center rounded-md bg-lime-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-lime-900 ring-1 ring-lime-300/80">
                {incoterm}
              </span>
            ) : null}
            <p
              className={cn(
                'px-0.5 text-center text-xs uppercase leading-snug tracking-wide',
                pay === 'available' ? 'font-normal text-slate-600' : 'font-semibold text-slate-700'
              )}
            >
              {SHIPPING_STATUS_SHORT[ship]}
              {pay !== 'available' && freight ? ` · ${freight}` : ''}
            </p>
          </div>

          <div className="mt-2.5 flex flex-col items-stretch gap-2">
            {pay === 'available' ? (
              <>
                {onReserve ? (
                  <Button
                    type="button"
                    size="sm"
                    className={RAIL_BRAND_BTN}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReserve();
                    }}
                  >
                    Reserve
                  </Button>
                ) : null}
                {hasActions ? (
                  <StockListCardActionsDropdown
                    invoice={invoice}
                    onEdit={onEdit}
                    onAssign={onAssign}
                    onSetBidRequester={onSetBidRequester}
                    onViewInfo={onViewInfo}
                    onReserve={onReserve}
                    onMakeAvailable={onMakeAvailable}
                    onShipping={onShipping}
                    onCourier={onCourier}
                    onDelete={onDelete}
                    onMarkCommissionPaid={onMarkCommissionPaid}
                  />
                ) : null}
                <Button type="button" size="sm" className={RAIL_BRAND_BTN} onClick={onViewInfo}>
                  View Info
                  <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0" />
                </Button>
              </>
            ) : (
              <>
                {onShipping ? (
                  <Button
                    type="button"
                    size="sm"
                    className={RAIL_BRAND_BTN}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShipping();
                    }}
                  >
                    Edit shipping
                  </Button>
                ) : null}
                {hasActions ? (
                  <StockListCardActionsDropdown
                    invoice={invoice}
                    onEdit={onEdit}
                    onAssign={onAssign}
                    onSetBidRequester={onSetBidRequester}
                    onViewInfo={onViewInfo}
                    onReserve={onReserve}
                    onMakeAvailable={onMakeAvailable}
                    onShipping={onShipping}
                    onCourier={onCourier}
                    onDelete={onDelete}
                    onMarkCommissionPaid={onMarkCommissionPaid}
                  />
                ) : null}
                <Button type="button" size="sm" className={RAIL_BRAND_BTN} onClick={onViewInfo}>
                  View Info
                  <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0" />
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
