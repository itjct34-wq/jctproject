'use client';

import Link from 'next/link';
import { AlertTriangle, CarFront, Check, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const safe = Number.isFinite(n) ? n : 0;
  const code = normalizeCurrency(currency);
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  const intLike = Math.abs(safe - Math.round(safe)) < 0.005;
  const digits = code === 'JPY' || code === 'PKR' || intLike ? 0 : 2;
  return `${symbol}${safe.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
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
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  customerName: string;
  customerCountry: string;
  agentName: string;
  invoice: { id: string; invoice_code: string } | null;
  paymentCount: number;
  allocatedUsd: number;
  onViewInfo: () => void;
  onEdit?: () => void;
  onReserve?: () => void;
  onShipping?: () => void;
  onDelete?: () => void;
  onMarkCommissionPaid?: () => void;
};

export function StockListCard({
  vehicle: v,
  checked,
  onCheckedChange,
  customerName,
  customerCountry,
  agentName,
  invoice,
  paymentCount,
  allocatedUsd,
  onViewInfo,
  onEdit,
  onReserve,
  onShipping,
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
  const hasActions = Boolean(onEdit || onReserve || onShipping || onDelete || onMarkCommissionPaid || invoice);

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-start gap-3 rounded-xl border px-3 py-3 shadow-sm sm:flex-nowrap sm:items-center sm:gap-4 sm:px-4',
        vehicleListRowClass(v),
        vehicleCommissionDueClass(v)
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3 sm:flex-nowrap">
        <div className="flex shrink-0 items-start gap-2 pt-1">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${v.stock_number}`}
            className="mt-1 border-slate-400 bg-white"
          />
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

        <div className="min-w-0 flex-1 basis-[16rem]">
          <p className="text-[15px] font-bold leading-tight tracking-tight text-sky-800">{v.stock_number}</p>
          <p className="text-[13px] font-bold uppercase leading-snug text-slate-900">{title || '—'}</p>
          {v.model_grade ? <p className="text-[12px] leading-snug text-slate-700">{v.model_grade}</p> : null}
          {chips.length ? (
            <p className="mt-0.5 text-[11px] uppercase leading-snug tracking-wide text-slate-600">{chips.join(' · ')}</p>
          ) : null}
          {v.chassis_number ? (
            <span className="mt-1.5 inline-flex rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
              {v.chassis_number}
            </span>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {cfNoFreight ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
                <AlertTriangle className="h-3 w-3" /> C&amp;F no freight
              </span>
            ) : null}
            {noBankRate ? (
              <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200">
                No bank rate
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-[8.5rem] shrink-0 text-[12px] leading-5">
          {place.city || place.country ? (
            <p className="font-semibold uppercase tracking-wide text-slate-800">
              {place.city ? `${place.city}${place.country ? ', ' : ''}` : ''}
              {place.country ? <span className="text-sky-700">{place.country}</span> : null}
            </p>
          ) : null}
          {v.location ? <p className="text-slate-600">{v.location}</p> : null}
          {dateLabel ? <p className="text-slate-500">{dateLabel}</p> : null}
          {bid != null ? (
            <p>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Bid </span>
              <span className="font-semibold text-rose-700">{listMoney(bid, purchaseCcy)}</span>
            </p>
          ) : null}
          {buyJpy != null ? (
            <p>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Buy </span>
              <span className="font-semibold text-slate-800">{listMoney(buyJpy, 'JPY')}</span>
            </p>
          ) : null}
          {fobUsd != null ? (
            <p>
              <span className="text-[10px] font-semibold uppercase text-slate-500">FOB </span>
              <span className="font-bold text-slate-900">{listMoney(Number(fobUsd), soldCcy)}</span>
            </p>
          ) : null}
          {showWeb && listed != null ? (
            <p>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Web </span>
              <span className="font-semibold">{listMoney(listed, v.listed_currency || 'USD')}</span>
            </p>
          ) : null}
        </div>

        <div className="min-w-[9rem] shrink-0 text-[12px] leading-5">
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
          {v.source_supplier ? <p className="uppercase text-slate-500">{v.source_supplier}</p> : null}
        </div>

        {showMoney ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <div className="min-w-[5.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wide text-sky-600">
                  Sold {incoterm ? <span className="text-lime-600">{incoterm}</span> : null}
                </p>
                <p className="text-[13px] font-bold leading-tight">{sold != null ? listMoney(sold, soldCcy) : '—'}</p>
              </div>
              <div className="min-w-[5.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Balance</p>
                <p className={cn('text-[13px] font-bold leading-tight', paidInFull ? 'text-emerald-700' : 'text-red-600')}>
                  {due != null ? listMoney(due, soldCcy) : '—'}
                </p>
                {paidInFull ? (
                  <p className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Paid in full
                  </p>
                ) : duePct != null ? (
                  <p className="text-[10px] font-semibold text-red-600">{duePct}% due</p>
                ) : null}
              </div>
              <div className="min-w-[5.5rem] rounded-md border border-white/80 bg-white/90 px-2 py-1.5 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Profit</p>
                <p className="text-[13px] font-bold leading-tight text-emerald-800">
                  {profit != null ? listMoney(profit, soldCcy) : '—'}
                </p>
                {v.tt_rate != null ? (
                  <p className="text-[10px] text-slate-500">@{Number(v.tt_rate)} TT</p>
                ) : null}
                <p className="text-[10px] font-semibold text-fuchsia-700">JP {markupPct}%</p>
                {commAmt != null && commAmt > 0 ? (
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-700">
                    Comm {listMoney(commAmt, 'PKR')}
                    {commStatus === 'paid' ? (
                      <span className="ml-1 rounded-full bg-emerald-600 px-1 text-[9px] uppercase text-white">Paid</span>
                    ) : commStatus === 'due' ? (
                      <span className="ml-1 rounded-full bg-fuchsia-100 px-1 text-[9px] uppercase text-fuchsia-900">Due</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
            {cfNoFreight ? (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> C&amp;F but NO Freight!
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1">
              {paymentCount > 0 ? (
                <span className="text-[11px] text-slate-600">
                  {paymentCount} remittance{paymentCount === 1 ? '' : 's'} · {listMoney(allocatedUsd, soldCcy)}
                </span>
              ) : null}
              {Array.from({ length: Math.min(paymentCount, 5) }).map((_, i) => (
                <span key={`tt-${i}`} className="inline-flex rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  TT
                </span>
              ))}
              {invoice ? (
                <Link
                  href={`/invoices?q=${encodeURIComponent(invoice.invoice_code)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white hover:bg-red-700"
                  title={invoice.invoice_code}
                >
                  <FileText className="h-3 w-3" /> INV
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex w-full shrink-0 flex-col items-stretch gap-1.5 sm:w-[11.5rem]">
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide',
            PAYMENT_STATUS_PILL_STYLES[pay]
          )}
        >
          {PAYMENT_STATUS_PILL_LABELS[pay]}
        </span>
        <p className="text-center text-[11px] font-semibold uppercase leading-tight text-slate-600">
          {SHIPPING_STATUS_SHORT[ship]}
          {freight ? ` · ${freight}` : ''}
        </p>
        {hasActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 justify-between bg-white/80 text-xs" onClick={(e) => e.stopPropagation()}>
                Actions <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onEdit ? <DropdownMenuItem onSelect={onEdit}>Edit stock</DropdownMenuItem> : null}
              {onReserve ? <DropdownMenuItem onSelect={onReserve}>Reserve</DropdownMenuItem> : null}
              {onShipping ? <DropdownMenuItem onSelect={onShipping}>Booking / shipping</DropdownMenuItem> : null}
              {onMarkCommissionPaid ? <DropdownMenuItem onSelect={onMarkCommissionPaid}>Mark commission paid</DropdownMenuItem> : null}
              {invoice ? (
                <DropdownMenuItem asChild>
                  <Link href={`/invoices?q=${encodeURIComponent(invoice.invoice_code)}`}>Open invoice</Link>
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button type="button" size="sm" className="h-8 bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700" onClick={onViewInfo}>
          View Info <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
