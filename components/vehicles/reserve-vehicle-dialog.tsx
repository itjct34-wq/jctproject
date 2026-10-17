'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Office, Vehicle } from '@/lib/types';
import { createReservationInvoice } from '@/lib/utils/create-reservation-invoice';
import { isCustomerConsigneeComplete } from '@/lib/utils/customer-contact';
import {
  freightValidationError,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';
import {
  BID_MARKUP_RATE,
  calcFobFromBid,
  DEFAULT_TT_RATE,
  FIXED_EXPENSE_JPY,
} from '@/lib/utils/vehicle-pricing';
import { incotermSelectOptions, publicFobUsd, reservationExclusivityMessage, type VehicleFreightMode, type VehicleIncoterm } from '@/lib/vehicle-lifecycle';
import { SOURCE_COUNTRIES, loadPortsForCountry } from '@/lib/source-countries';

type ContainerSize = '20ft Container' | '40ft Container' | '40ft HC';

type CustomerRow = Pick<
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  customers: CustomerRow[];
  offices: Office[];
  agentNames?: Record<string, string>;
  onSaved: () => void | Promise<void>;
};

type ChargeKey =
  | 'service'
  | 'freight'
  | 'vanning'
  | 'inspection'
  | 'insurance'
  | 'trailer'
  | 'inland'
  | 'clearing'
  | 'courier'
  | 'other';

const CHARGE_FIELDS: { key: ChargeKey; label: string }[] = [
  { key: 'service', label: 'Service' },
  { key: 'freight', label: 'Freight' },
  { key: 'vanning', label: 'Vanning' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'trailer', label: 'Trailer' },
  { key: 'inland', label: 'Inland' },
  { key: 'clearing', label: 'Clearing' },
  { key: 'courier', label: 'Courier' },
  { key: 'other', label: 'Other' },
];

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className || 'space-y-0.5'}>
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function emptyCharges(): Record<ChargeKey, string> {
  return {
    service: '',
    freight: '',
    vanning: '',
    inspection: '',
    insurance: '',
    trailer: '',
    inland: '',
    clearing: '',
    courier: '',
    other: '',
  };
}

function roundMoney(n: number) {
  return Math.round(n);
}

function money(n: number, ccy = 'USD') {
  return `${ccy} ${roundMoney(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function agentLabel(
  id: string | null | undefined,
  agentNames: Record<string, string> | undefined,
  fallback: string
) {
  if (!id) return fallback;
  return agentNames?.[id]?.trim() || fallback;
}

export function ReserveVehicleDialog({
  open,
  onOpenChange,
  vehicle,
  customers,
  offices,
  agentNames,
  onSaved,
}: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [quotedCurrency, setQuotedCurrency] = useState('USD');
  const [quotedTerm, setQuotedTerm] = useState<VehicleIncoterm>('FOB');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [shipmentTerm, setShipmentTerm] = useState<VehicleIncoterm>('FOB');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [auctionHouse, setAuctionHouse] = useState('');
  const [paymentTermPct, setPaymentTermPct] = useState('100');
  const [freightMode, setFreightMode] = useState<'' | VehicleFreightMode>('');
  const [containerSize, setContainerSize] = useState<ContainerSize>('40ft Container');
  const [officeId, setOfficeId] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterAgentId, setRequesterAgentId] = useState<string | null>(null);
  const [charges, setCharges] = useState(emptyCharges);

  const [consigneeName, setConsigneeName] = useState('');
  const [consigneeCountry, setConsigneeCountry] = useState('');
  const [consigneeCity, setConsigneeCity] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [notifySame, setNotifySame] = useState(true);
  const [notifyName, setNotifyName] = useState('');
  const [notifyCountry, setNotifyCountry] = useState('');
  const [notifyCity, setNotifyCity] = useState('');
  const [notifyAddress, setNotifyAddress] = useState('');
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');

  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentDue, setPaymentDue] = useState('');
  const [discount, setDiscount] = useState('');
  const [emailInvoice, setEmailInvoice] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [reserveDays, setReserveDays] = useState('7');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  const fobBreakdown = useMemo(() => {
    if (!vehicle) return null;
    const bid = vehicle.purchase_price != null ? Number(vehicle.purchase_price) : null;
    const expense = vehicle.expense_jpy == null ? FIXED_EXPENSE_JPY : Number(vehicle.expense_jpy) || 0;
    const tt = vehicle.tt_rate == null ? DEFAULT_TT_RATE : Number(vehicle.tt_rate) || DEFAULT_TT_RATE;
    const calc = bid != null ? calcFobFromBid(bid, expense, tt) : null;
    const stored = publicFobUsd(vehicle);
    const fobUsd = stored != null ? Number(stored) : calc ? roundMoney(calc.fobUsd) : null;
    return { bid, expense, tt, calc, fobUsd };
  }, [vehicle]);

  const fobUsd = fobBreakdown?.fobUsd ?? null;

  const shipmentTypeLabel = freightMode === 'container' ? 'Container' : 'RORO';
  const containerModeLabel =
    freightMode === 'container' ? containerSize : freightMode === 'roro' ? 'RORO Vessel' : 'RORO Vessel';
  const freightPolicy = useMemo(
    () =>
      resolveFreightPolicy({
        incoterm: shipmentTerm,
        shipmentType: shipmentTypeLabel,
        containerMode: containerModeLabel,
        freightMode: freightMode || null,
      }),
    [shipmentTerm, shipmentTypeLabel, containerModeLabel, freightMode]
  );

  const chargeExtras = useMemo(
    () =>
      CHARGE_FIELDS.reduce((sum, { key }) => {
        if (key === 'freight' && !freightPolicy.allowFreight) return sum;
        return sum + (Number(charges[key]) || 0);
      }, 0),
    [charges, freightPolicy.allowFreight]
  );

  const quotedUsd = Number(quotedPrice) || 0;
  const discountUsd = Number(discount) || 0;
  const profitUsd = fobUsd != null && quotedPrice !== '' ? roundMoney(quotedUsd - fobUsd) : null;
  const invoiceTotal = roundMoney(Math.max(0, quotedUsd + chargeExtras - discountUsd));

  useEffect(() => {
    if (freightPolicy.allowFreight) return;
    setCharges((prev) => (prev.freight ? { ...prev, freight: '' } : prev));
  }, [freightPolicy.allowFreight]);

  useEffect(() => {
    if (!open || !vehicle || !profile) return;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 7);
    const todayStr = today.toISOString().slice(0, 10);
    const dueStr = due.toISOString().slice(0, 10);
    const bid = vehicle.purchase_price != null ? Number(vehicle.purchase_price) : null;
    const expense = vehicle.expense_jpy == null ? FIXED_EXPENSE_JPY : Number(vehicle.expense_jpy) || 0;
    const tt = vehicle.tt_rate == null ? DEFAULT_TT_RATE : Number(vehicle.tt_rate) || DEFAULT_TT_RATE;
    const calc = bid != null ? calcFobFromBid(bid, expense, tt) : null;
    const stored = publicFobUsd(vehicle);
    const fob = stored != null ? Number(stored) : calc ? roundMoney(calc.fobUsd) : null;

    setCustomerId('');
    setQuotedCurrency('USD');
    setQuotedTerm((vehicle.incoterm as VehicleIncoterm) || 'FOB');
    setQuotedPrice(fob != null ? String(roundMoney(fob)) : '');
    setInvoiceCurrency('USD');
    setShipmentTerm((vehicle.incoterm as VehicleIncoterm) || 'FOB');
    setDestinationCountry('');
    setDestinationPort('');
    setAuctionHouse(vehicle.source_supplier || '');
    setPaymentTermPct('100');
    setFreightMode(vehicle.freight_mode === 'roro' || vehicle.freight_mode === 'container' ? vehicle.freight_mode : '');
    setContainerSize('40ft Container');
    setOfficeId(profile.office_id || offices[0]?.id || '');
    setRequesterName(profile.full_name || profile.email || '');
    setRequesterAgentId(profile.id);
    setCharges({
      ...emptyCharges(),
      freight: vehicle.shipping_freight_charges != null ? String(vehicle.shipping_freight_charges) : '',
      vanning: vehicle.shipping_vanning_charges != null ? String(vehicle.shipping_vanning_charges) : '',
    });
    setConsigneeName('');
    setConsigneeCountry('');
    setConsigneeCity('');
    setConsigneeAddress('');
    setConsigneePhone('');
    setConsigneeEmail('');
    setNotifySame(true);
    setNotifyName('');
    setNotifyCountry('');
    setNotifyCity('');
    setNotifyAddress('');
    setNotifyPhone('');
    setNotifyEmail('');
    setInvoiceDate(todayStr);
    // Due / payment due follow invoice date (no separate manual pickers).
    setDueDate(dueStr);
    setPaymentDue(dueStr);
    setDiscount('');
    setEmailInvoice(false);
    setRemarks('');
    setReserveDays('7');
  }, [open, vehicle, profile, offices]);

  useEffect(() => {
    if (!selectedCustomer || !profile) return;

    setConsigneeName(selectedCustomer.company_name || selectedCustomer.full_name || '');
    setConsigneeCountry(selectedCustomer.country || '');
    setConsigneeCity(selectedCustomer.city || '');
    setConsigneeAddress(selectedCustomer.address_line1 || '');
    setConsigneePhone(selectedCustomer.phone || '');
    setConsigneeEmail(selectedCustomer.email || '');
    setDestinationCountry(selectedCustomer.country || '');
    if (selectedCustomer.port_of_discharge) {
      setDestinationPort(selectedCustomer.port_of_discharge);
    }

    // Keep reservation quote/invoice in USD (FOB workflow). Do not flip to customer JPY.
    setQuotedCurrency('USD');
    setInvoiceCurrency('USD');

    const agentId = selectedCustomer.assigned_to || profile.id;
    setRequesterAgentId(agentId);
    setRequesterName(agentLabel(agentId, agentNames, profile.full_name || profile.email || ''));

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, display_name, email, office_id')
        .eq('id', agentId)
        .maybeSingle();
      if (cancelled || !data) {
        if (!cancelled && agentId === profile.id) {
          setOfficeId(profile.office_id || offices[0]?.id || '');
        }
        return;
      }
      const name =
        (data.display_name || data.full_name || data.email || '').trim() ||
        agentLabel(agentId, agentNames, profile.full_name || profile.email || '');
      setRequesterName(name);
      if (data.office_id) setOfficeId(data.office_id);
      else if (agentId === profile.id) setOfficeId(profile.office_id || offices[0]?.id || '');
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomer, profile, agentNames, offices]);

  useEffect(() => {
    if (!notifySame) return;
    setNotifyName(consigneeName);
    setNotifyCountry(consigneeCountry);
    setNotifyCity(consigneeCity);
    setNotifyAddress(consigneeAddress);
    setNotifyPhone(consigneePhone);
    setNotifyEmail(consigneeEmail);
  }, [notifySame, consigneeName, consigneeCountry, consigneeCity, consigneeAddress, consigneePhone, consigneeEmail]);

  const destPorts = useMemo(() => {
    const match = SOURCE_COUNTRIES.find(
      (c) => c.name.toLowerCase() === destinationCountry.trim().toLowerCase() || c.code === destinationCountry.trim().toUpperCase()
    );
    return match ? loadPortsForCountry(match.code) : [];
  }, [destinationCountry]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle || !profile) return;
    if (!customerId) {
      toast.error('Select a customer');
      return;
    }
    const consigneeErr = isCustomerConsigneeComplete({
      full_name: consigneeName,
      email: consigneeEmail,
      phone: consigneePhone,
      address_line1: consigneeAddress,
    });
    if (consigneeErr) {
      toast.error(consigneeErr);
      return;
    }
    if (!destinationCountry.trim() || !destinationPort.trim()) {
      toast.error('Destination country and port are required');
      return;
    }
    if (!invoiceDate) {
      toast.error('Invoice date is required');
      return;
    }

    const vehicleLineUsd = quotedUsd > 0 ? quotedUsd : fobUsd || 0;
    if (vehicleLineUsd <= 0) {
      toast.error('Quoted price (USD) must be greater than zero');
      return;
    }
    const freightAmt = freightPolicy.allowFreight ? Number(charges.freight) || 0 : 0;
    const freightErr = freightValidationError(freightPolicy, freightAmt);
    if (freightErr) {
      toast.error(freightErr);
      return;
    }
    const totalUsd = roundMoney(Math.max(0, vehicleLineUsd + chargeExtras - discountUsd));
    if (totalUsd <= 0) {
      toast.error('Invoice total must be greater than zero');
      return;
    }

    setSubmitting(true);
    const { data: liveRow, error: liveErr } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle.id)
      .maybeSingle();
    if (liveErr || !liveRow) {
      setSubmitting(false);
      toast.error(liveErr?.message || 'Could not load vehicle');
      return;
    }
    const live = liveRow as Vehicle;
    const conflict = reservationExclusivityMessage(live, profile.id, agentNames);
    if (conflict) {
      setSubmitting(false);
      toast.error(conflict);
      return;
    }

    const days = Math.max(1, Number(reserveDays) || 7);
    const reservedUntil = new Date();
    reservedUntil.setDate(reservedUntil.getDate() + days);
    const reservedUntilStr = reservedUntil.toISOString().slice(0, 10);
    const mode: VehicleFreightMode | null =
      freightMode === 'roro' || freightMode === 'container' ? freightMode : null;
    const reserveAgentId = requesterAgentId || selectedCustomer?.assigned_to || profile.id;

    const { data: claimed, error: claimErr } = await supabase
      .from('vehicles')
      .update({
        payment_status: 'reserved',
        status: 'reserved',
        customer_id: customerId,
        reserved_by: reserveAgentId,
        reserved_until: reservedUntilStr,
        sold_price: totalUsd,
        incoterm: shipmentTerm,
        freight_mode: mode,
        shipping_port_of_discharge: destinationPort.trim(),
        shipping_place_of_delivery: destinationPort.trim(),
        shipping_freight_charges: freightPolicy.allowFreight ? Number(charges.freight) || null : null,
        shipping_vanning_charges: Number(charges.vanning) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicle.id)
      .eq('payment_status', 'available')
      .is('reserved_by', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      setSubmitting(false);
      toast.error(claimErr.message);
      return;
    }
    if (!claimed) {
      setSubmitting(false);
      toast.error('Already reserved by another agent');
      await onSaved();
      return;
    }

    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        customer_id: customerId,
        vehicle_id: vehicle.id,
        sale_date: invoiceDate,
        sale_price: totalUsd,
        currency: invoiceCurrency || 'USD',
        deposit_amount: 0,
        status: 'reserved',
        notes: [
          remarks.trim(),
          `Quoted ${quotedTerm} USD ${vehicleLineUsd}`,
          fobUsd != null ? `FOB USD ${fobUsd}` : '',
          profitUsd != null ? `Profit USD ${profitUsd}` : '',
          `Invoice total USD ${totalUsd} (quoted + freight/charges)`,
          `Destination: ${destinationCountry} / ${destinationPort}`,
          auctionHouse ? `Auction / yard: ${auctionHouse}` : '',
          `Payment term: ${paymentTermPct}%`,
          requesterName ? `Requester: ${requesterName}` : '',
          officeId ? `Office: ${offices.find((o) => o.id === officeId)?.name || officeId}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        created_by: profile.id,
      })
      .select()
      .maybeSingle();

    if (saleErr || !saleData) {
      setSubmitting(false);
      toast.error(`Reserved but sale failed: ${saleErr?.message || 'unknown'}`);
      await onSaved();
      return;
    }

    await supabase.from('vehicle_status_history').insert({
      vehicle_id: vehicle.id,
      from_status: live.status,
      to_status: 'reserved',
      note: `Reserved for ${selectedCustomer?.full_name || customerId} · ${shipmentTerm}`,
      changed_by: profile.id,
    });

    const shipmentType = mode === 'container' ? 'Container' : 'RORO';
    const containerMode = mode === 'container' ? containerSize : 'RORO Vessel';
    const chargePayload = Object.fromEntries(
      CHARGE_FIELDS.map(({ key }) => {
        if (key === 'freight' && !freightPolicy.allowFreight) return [key, 0];
        return [key, Number(charges[key]) || 0];
      })
    ) as Record<ChargeKey, number>;
    const inv = await createReservationInvoice({
      customerId,
      saleId: saleData.id,
      vehicleId: vehicle.id,
      vehicle: live,
      salePrice: vehicleLineUsd,
      currency: 'USD',
      priceTerm: shipmentTerm,
      shipmentType,
      containerMode,
      portOfLoading: live.shipping_port_of_loading || 'Nagoya, Japan',
      portOfDischarge: destinationPort.trim(),
      destinationCountry: destinationCountry.trim(),
      freightUsd: freightAmt,
      insuranceUsd: Number(charges.insurance) || 0,
      discountUsd,
      charges: chargePayload,
      consignee: {
        name: consigneeName.trim(),
        country: consigneeCountry.trim(),
        city: consigneeCity.trim(),
        address: consigneeAddress.trim(),
        phone: consigneePhone.trim(),
        email: consigneeEmail.trim(),
      },
      notifyParty: {
        name: (notifySame ? consigneeName : notifyName).trim(),
        country: (notifySame ? consigneeCountry : notifyCountry).trim(),
        city: (notifySame ? consigneeCity : notifyCity).trim(),
        address: (notifySame ? consigneeAddress : notifyAddress).trim(),
        phone: (notifySame ? consigneePhone : notifyPhone).trim(),
        email: (notifySame ? consigneeEmail : notifyEmail).trim(),
      },
      issueDate: invoiceDate,
      dueDate: dueDate || invoiceDate,
      paymentDueDate: paymentDue || dueDate || invoiceDate,
      paymentTerms: `${paymentTermPct}% T/T in advance`,
      remarks: remarks.trim() || null,
      emailInvoice,
      salesAgentName: requesterName || profile.full_name || profile.email || null,
      createdBy: profile.id,
      invoiceType: 'commercial',
    });

    setSubmitting(false);
    if (!inv.ok) {
      toast.error(`Reserved but invoice failed: ${inv.error}`);
    } else {
      toast.success(`Reserved for ${selectedCustomer?.full_name || 'customer'}`);
    }
    onOpenChange(false);
    await onSaved();
  };

  if (!vehicle) return null;

  const markupPct = Math.round(BID_MARKUP_RATE * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Reserve Vehicle · {vehicle.stock_number} · {vehicle.make} {vehicle.model}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-2.5">
          <section className="space-y-1.5 rounded-md border border-border/70 p-2.5">
            <h3 className="text-xs font-semibold text-primary">Selling Detail</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Customer" required>
                <Select value={customerId || 'none'} onValueChange={(v) => setCustomerId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select…</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} ({c.customer_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Customer Quoted Currency" required>
                <Input value={quotedCurrency} onChange={(e) => setQuotedCurrency(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Quoted Term" required>
                <Select value={quotedTerm} onValueChange={(v: VehicleIncoterm) => setQuotedTerm(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incotermSelectOptions(quotedTerm).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quoted Price (USD)">
                <Input
                  type="number"
                  step="0.01"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                />
              </Field>
              <Field label="Requester Person" required>
                <Input value={requesterName} readOnly />
              </Field>
              <Field label="Person Office" required>
                <Select value={officeId || 'none'} onValueChange={(v) => setOfficeId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Office" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select…</SelectItem>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice Currency" required>
                <Input value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Shipment Term" required>
                <Select value={shipmentTerm} onValueChange={(v: VehicleIncoterm) => setShipmentTerm(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {incotermSelectOptions(shipmentTerm).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Destination Country" required>
                <Input value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value)} list="reserve-dest-countries" />
                <datalist id="reserve-dest-countries">
                  {SOURCE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Destination Port" required>
                <Input value={destinationPort} onChange={(e) => setDestinationPort(e.target.value)} list="reserve-dest-ports" />
                <datalist id="reserve-dest-ports">
                  {destPorts.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
              <Field label="Auction House / Yard">
                <Input value={auctionHouse} onChange={(e) => setAuctionHouse(e.target.value)} />
              </Field>
              <Field label="Payment Term %">
                <Input type="number" value={paymentTermPct} onChange={(e) => setPaymentTermPct(e.target.value)} />
              </Field>
              <Field label="Shipment Type">
                <Select
                  value={freightMode || 'none'}
                  onValueChange={(v) => setFreightMode(v === 'none' ? '' : (v as VehicleFreightMode))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="roro">RORO</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {freightMode === 'container' && (
                <Field label="Container size">
                  <Select value={containerSize} onValueChange={(v: ContainerSize) => setContainerSize(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20ft Container">20ft</SelectItem>
                      <SelectItem value="40ft Container">40ft</SelectItem>
                      <SelectItem value="40ft HC">40ft HC</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Hold (days)">
                <Input type="number" min={1} value={reserveDays} onChange={(e) => setReserveDays(e.target.value)} />
              </Field>
            </div>
            {!freightPolicy.allowFreight && (
              <p className="text-xs text-muted-foreground">
                FOB — vehicle cost only; freight charge is excluded from the reservation invoice.
              </p>
            )}
            {freightPolicy.requireFreight && (
              <p className="text-xs text-amber-700">
                Container + {shipmentTerm}: enter Ocean freight (USD) below.
              </p>
            )}

            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reservation pricing (USD FOB)
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Bid (purchase)</p>
                  <p className="font-medium">
                    {fobBreakdown?.bid != null
                      ? `¥${Math.round(fobBreakdown.bid).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">+{markupPct}% markup</p>
                  <p className="font-medium">
                    {fobBreakdown?.calc
                      ? `¥${Math.round(fobBreakdown.calc.markupJpy).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">+ Expense JPY</p>
                  <p className="font-medium">
                    {fobBreakdown
                      ? `¥${Math.round(fobBreakdown.expense).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">÷ TT rate</p>
                  <p className="font-medium">{fobBreakdown ? fobBreakdown.tt : DEFAULT_TT_RATE}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">FOB USD</p>
                  <p className="font-semibold text-primary">
                    {fobUsd != null ? money(fobUsd) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Profit (quoted − FOB)</p>
                  <p className={`font-semibold ${profitUsd != null && profitUsd < 0 ? 'text-destructive' : ''}`}>
                    {profitUsd != null ? money(profitUsd) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Freight + charges (not profit)</p>
                  <p className="font-medium">{money(chargeExtras)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Invoice total</p>
                  <p className="font-semibold">{money(invoiceTotal)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                (Bid + {markupPct}% + expense) ÷ TT → FOB USD · quoted − FOB = profit (freight excluded) · quoted + freight/charges − discount = invoice
              </p>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
              {CHARGE_FIELDS.map(({ key, label }) => {
                const isFreight = key === 'freight';
                const disabled = isFreight && !freightPolicy.allowFreight;
                return (
                  <Field
                    key={key}
                    label={`${isFreight ? 'Ocean freight' : label} (USD)${isFreight && freightPolicy.requireFreight ? ' *' : ''}`}
                  >
                    <Input
                      type="number"
                      step="0.01"
                      value={disabled ? '' : charges[key]}
                      disabled={disabled}
                      required={isFreight && freightPolicy.requireFreight}
                      onChange={(e) => setCharges((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={disabled ? 'N/A (FOB)' : undefined}
                    />
                  </Field>
                );
              })}
            </div>
            <Field label="Selling / invoice amount (USD)" required className="max-w-xs space-y-1">
              <Input type="number" readOnly value={String(invoiceTotal)} />
              <p className="text-xs text-muted-foreground">
                Quoted {quotedPrice !== '' ? money(quotedUsd) : '—'} + charges {money(chargeExtras)}
                {discountUsd > 0 ? ` − discount ${money(discountUsd)}` : ''}
              </p>
            </Field>
          </section>

          <section className="space-y-1.5 rounded-md border border-border/70 p-2.5">
            <h3 className="text-xs font-semibold text-primary">Consignee Detail</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" required><Input value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} /></Field>
              <Field label="Country" required><Input value={consigneeCountry} onChange={(e) => setConsigneeCountry(e.target.value)} /></Field>
              <Field label="City"><Input value={consigneeCity} onChange={(e) => setConsigneeCity(e.target.value)} /></Field>
              <Field label="Address" required className="sm:col-span-2 space-y-0.5">
                <Input value={consigneeAddress} onChange={(e) => setConsigneeAddress(e.target.value)} />
              </Field>
              <Field label="Phone" required><Input value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} /></Field>
              <Field label="Email" required><Input type="email" value={consigneeEmail} onChange={(e) => setConsigneeEmail(e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium">
              <Checkbox checked={notifySame} onCheckedChange={(v) => setNotifySame(v === true)} />
              Notify party same as consignee
            </label>
            {!notifySame ? (
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Notify name"><Input value={notifyName} onChange={(e) => setNotifyName(e.target.value)} /></Field>
                <Field label="Notify country"><Input value={notifyCountry} onChange={(e) => setNotifyCountry(e.target.value)} /></Field>
                <Field label="Notify city"><Input value={notifyCity} onChange={(e) => setNotifyCity(e.target.value)} /></Field>
                <Field label="Notify address" className="sm:col-span-2 space-y-0.5">
                  <Input value={notifyAddress} onChange={(e) => setNotifyAddress(e.target.value)} />
                </Field>
                <Field label="Notify phone"><Input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} /></Field>
                <Field label="Notify email"><Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} /></Field>
              </div>
            ) : null}
          </section>

          <section className="space-y-1.5 rounded-md border border-border/70 p-2.5">
            <h3 className="text-xs font-semibold text-primary">Invoice Detail</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Invoice date" required>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setInvoiceDate(next);
                    // Link due / payment due to invoice date (+7 days) — printed Issue date uses this.
                    if (next) {
                      const d = new Date(`${next}T12:00:00`);
                      d.setDate(d.getDate() + 7);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      const linked = `${y}-${m}-${day}`;
                      setDueDate(linked);
                      setPaymentDue(linked);
                    } else {
                      setDueDate('');
                      setPaymentDue('');
                    }
                  }}
                />
              </Field>
              <Field label="Discount (USD)">
                <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Invoice amount (USD)">
                <Input readOnly value={String(invoiceTotal)} />
              </Field>
              <Field label="Total (USD)">
                <Input readOnly value={String(invoiceTotal)} />
              </Field>
            </div>
            {invoiceDate ? (
              <p className="text-xs text-muted-foreground">
                Due / payment due linked to invoice date: {dueDate || '—'} (printed document uses invoice
                issue date).
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={emailInvoice} onCheckedChange={(v) => setEmailInvoice(v === true)} />
              Email invoice
            </label>
            <Field label="Remarks">
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !customerId} className="bg-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
