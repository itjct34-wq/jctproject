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
import { publicFobUsd, reservationExclusivityMessage, type VehicleFreightMode, type VehicleIncoterm } from '@/lib/vehicle-lifecycle';
import { SOURCE_COUNTRIES, loadPortsForCountry } from '@/lib/source-countries';

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
    <div className={className || 'space-y-1'}>
      <Label className="text-xs font-medium">
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
  const [officeId, setOfficeId] = useState('');
  const [charges, setCharges] = useState(emptyCharges);
  const [sellingPrice, setSellingPrice] = useState('');

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

  const chargeSum = useMemo(() => {
    const fob = vehicle ? Number(publicFobUsd(vehicle)) || 0 : 0;
    const extras = CHARGE_FIELDS.reduce((sum, { key }) => sum + (Number(charges[key]) || 0), 0);
    return fob + extras;
  }, [charges, vehicle]);

  useEffect(() => {
    if (!open || !vehicle || !profile) return;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 7);
    const todayStr = today.toISOString().slice(0, 10);
    const dueStr = due.toISOString().slice(0, 10);
    const fob = publicFobUsd(vehicle);
    setCustomerId('');
    setQuotedCurrency('USD');
    setQuotedTerm((vehicle.incoterm as VehicleIncoterm) || 'FOB');
    setQuotedPrice(fob != null ? String(fob) : '');
    setInvoiceCurrency('USD');
    setShipmentTerm((vehicle.incoterm as VehicleIncoterm) || 'FOB');
    setDestinationCountry('');
    setDestinationPort('');
    setAuctionHouse(vehicle.source_supplier || '');
    setPaymentTermPct('100');
    setFreightMode(vehicle.freight_mode === 'roro' || vehicle.freight_mode === 'container' ? vehicle.freight_mode : '');
    setOfficeId(profile.office_id || offices[0]?.id || '');
    setCharges({
      ...emptyCharges(),
      freight: vehicle.shipping_freight_charges != null ? String(vehicle.shipping_freight_charges) : '',
      vanning: vehicle.shipping_vanning_charges != null ? String(vehicle.shipping_vanning_charges) : '',
    });
    setSellingPrice(fob != null ? String(fob) : '');
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
    setDueDate(dueStr);
    setPaymentDue(dueStr);
    setDiscount('');
    setEmailInvoice(false);
    setRemarks('');
    setReserveDays('7');
  }, [open, vehicle, profile, offices]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setConsigneeName(selectedCustomer.company_name || selectedCustomer.full_name || '');
    setConsigneeCountry(selectedCustomer.country || '');
    setConsigneeCity(selectedCustomer.city || '');
    setConsigneeAddress(selectedCustomer.address_line1 || '');
    setConsigneePhone(selectedCustomer.phone || '');
    setConsigneeEmail(selectedCustomer.email || '');
    setDestinationCountry((prev) => prev || selectedCustomer.country || '');
    if (selectedCustomer.default_currency) {
      setQuotedCurrency(selectedCustomer.default_currency);
      setInvoiceCurrency(selectedCustomer.default_currency);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (!notifySame) return;
    setNotifyName(consigneeName);
    setNotifyCountry(consigneeCountry);
    setNotifyCity(consigneeCity);
    setNotifyAddress(consigneeAddress);
    setNotifyPhone(consigneePhone);
    setNotifyEmail(consigneeEmail);
  }, [notifySame, consigneeName, consigneeCountry, consigneeCity, consigneeAddress, consigneePhone, consigneeEmail]);

  useEffect(() => {
    if (sellingPrice === '' || Number(sellingPrice) === chargeSum || chargeSum > 0) {
      setSellingPrice(String(Math.round(chargeSum * 100) / 100));
    }
    // Only sync when charges/fob change — not when user types selling price
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeSum]);

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
    if (!invoiceDate || !dueDate || !paymentDue) {
      toast.error('Invoice date, due date and payment due are required');
      return;
    }

    const salePrice = Number(sellingPrice) || chargeSum || 0;
    if (salePrice <= 0) {
      toast.error('Selling price must be greater than zero');
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

    const { data: claimed, error: claimErr } = await supabase
      .from('vehicles')
      .update({
        payment_status: 'reserved',
        customer_id: customerId,
        reserved_by: profile.id,
        reserved_until: reservedUntilStr,
        sold_price: salePrice,
        incoterm: shipmentTerm,
        freight_mode: mode,
        shipping_port_of_discharge: destinationPort.trim(),
        shipping_place_of_delivery: destinationPort.trim(),
        shipping_freight_charges: Number(charges.freight) || null,
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
        sale_price: salePrice,
        currency: invoiceCurrency || 'USD',
        deposit_amount: 0,
        status: 'reserved',
        notes: [
          remarks.trim(),
          `Quoted ${quotedTerm} ${quotedCurrency} ${quotedPrice || salePrice}`,
          `Destination: ${destinationCountry} / ${destinationPort}`,
          auctionHouse ? `Auction / yard: ${auctionHouse}` : '',
          `Payment term: ${paymentTermPct}%`,
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
    const containerMode = mode === 'container' ? '40ft Container' : 'RORO Vessel';
    const inv = await createReservationInvoice({
      customerId,
      saleId: saleData.id,
      vehicleId: vehicle.id,
      vehicle: live,
      salePrice,
      currency: invoiceCurrency || 'USD',
      priceTerm: shipmentTerm,
      shipmentType,
      containerMode,
      portOfLoading: live.shipping_port_of_loading || 'Nagoya, Japan',
      portOfDischarge: destinationPort.trim(),
      destinationCountry: destinationCountry.trim(),
      freightUsd: Number(charges.freight) || 0,
      insuranceUsd: Number(charges.insurance) || 0,
      discountUsd: Number(discount) || 0,
      charges: Object.fromEntries(
        CHARGE_FIELDS.map(({ key }) => [key, Number(charges[key]) || 0])
      ) as Record<ChargeKey, number>,
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
      dueDate,
      paymentDueDate: paymentDue,
      paymentTerms: `${paymentTermPct}% T/T in advance`,
      remarks: remarks.trim() || null,
      emailInvoice,
      salesAgentName: profile.full_name || profile.email || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Reserve Vehicle · {vehicle.stock_number} · {vehicle.make} {vehicle.model}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold text-primary">Selling Detail</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    {(['FOB', 'C&F', 'CIF'] as VehicleIncoterm[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quoted Price">
                <Input type="number" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
              </Field>
              <Field label="Requester Person" required>
                <Input value={profile?.full_name || profile?.email || ''} readOnly />
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
                    {(['FOB', 'C&F', 'CIF'] as VehicleIncoterm[]).map((t) => (
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
              <Field label="Hold (days)">
                <Input type="number" min={1} value={reserveDays} onChange={(e) => setReserveDays(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CHARGE_FIELDS.map(({ key, label }) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    value={charges[key]}
                    onChange={(e) => setCharges((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
            <Field label="Selling Price (FOB + charges)" required className="max-w-xs space-y-1">
              <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Prefill FOB {vehicle ? publicFobUsd(vehicle) ?? '—' : '—'} · charge sum {chargeSum.toLocaleString()}
              </p>
            </Field>
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold text-primary">Consignee Detail</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" required><Input value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} /></Field>
              <Field label="Country" required><Input value={consigneeCountry} onChange={(e) => setConsigneeCountry(e.target.value)} /></Field>
              <Field label="City"><Input value={consigneeCity} onChange={(e) => setConsigneeCity(e.target.value)} /></Field>
              <Field label="Address" required className="sm:col-span-2 space-y-1">
                <Input value={consigneeAddress} onChange={(e) => setConsigneeAddress(e.target.value)} />
              </Field>
              <Field label="Phone" required><Input value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} /></Field>
              <Field label="Email" required><Input type="email" value={consigneeEmail} onChange={(e) => setConsigneeEmail(e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={notifySame} onCheckedChange={(v) => setNotifySame(v === true)} />
              Notify party same as consignee
            </label>
            {!notifySame ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Notify name"><Input value={notifyName} onChange={(e) => setNotifyName(e.target.value)} /></Field>
                <Field label="Notify country"><Input value={notifyCountry} onChange={(e) => setNotifyCountry(e.target.value)} /></Field>
                <Field label="Notify city"><Input value={notifyCity} onChange={(e) => setNotifyCity(e.target.value)} /></Field>
                <Field label="Notify address" className="sm:col-span-2 space-y-1">
                  <Input value={notifyAddress} onChange={(e) => setNotifyAddress(e.target.value)} />
                </Field>
                <Field label="Notify phone"><Input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} /></Field>
                <Field label="Notify email"><Input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} /></Field>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-border/70 p-4">
            <h3 className="text-sm font-semibold text-primary">Invoice Detail</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Invoice date" required>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </Field>
              <Field label="Due date" required>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Payment due" required>
                <Input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} />
              </Field>
              <Field label="Discount">
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Invoice amount">
                <Input readOnly value={sellingPrice} />
              </Field>
              <Field label="Total">
                <Input
                  readOnly
                  value={String(Math.max(0, (Number(sellingPrice) || 0) - (Number(discount) || 0)))}
                />
              </Field>
            </div>
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
