'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
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
import type { Quotation, Customer, Vehicle } from '@/lib/types';
import { CommercialQuotationTemplate } from '@/components/quotations/commercial-quotation-template';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currencies';
import { ChevronRight, FileText, Loader2, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Quotation['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  converted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const emptyForm = {
  customer_id: '',
  vehicle_id: '',
  price_type: 'FOB' as Quotation['price_type'],
  subtotal: '',
  freight: '',
  insurance: '',
  other_fees: '',
  currency: 'USD',
  valid_until: '',
  notes: '',
  description: '',
};

export default function QuotationsPage() {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [printItems, setPrintItems] = useState<
    Array<{ description: string; quantity: number; unit_price: number; line_total: number }>
  >([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [qRes, cRes, vRes] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, full_name, customer_code, email, phone, country, city, address_line1')
        .order('full_name'),
      supabase
        .from('vehicles')
        .select(
          'id, stock_number, make, model, chassis_number, model_year, color, mileage_km, listed_price, listed_currency, status'
        )
        .in('status', ['in_stock', 'reserved'])
        .order('updated_at', { ascending: false }),
    ]);
    if (qRes.error) toast.error(`Unable to load quotations: ${qRes.error.message}`);
    else setQuotations((qRes.data || []) as Quotation[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((qt) => {
      const matchesStatus = statusFilter === 'all' || qt.status === statusFilter;
      const matchesSearch =
        !q || [qt.quotation_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, search, statusFilter]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';
  const customerOf = (id: string) => customers.find((c) => c.id === id) || null;

  const buildDescription = () => {
    if (form.description.trim()) return form.description.trim();
    const v = vehicles.find((x) => x.id === form.vehicle_id);
    if (!v) return `${form.price_type} quotation`;
    return [
      `${v.make} ${v.model}`,
      v.model_year ? `Year: ${v.model_year}` : null,
      v.chassis_number ? `Chassis: ${v.chassis_number}` : null,
      v.stock_number ? `Stock: ${v.stock_number}` : null,
      v.color ? `Color: ${v.color}` : null,
      `Terms: ${form.price_type}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  useEffect(() => {
    if (!form.vehicle_id) return;
    const v = vehicles.find((x) => x.id === form.vehicle_id);
    if (v?.listed_price != null && !form.subtotal) {
      setForm((f) => ({
        ...f,
        subtotal: String(v.listed_price),
        currency: v.listed_currency || f.currency,
      }));
    }
  }, [form.vehicle_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id) return;
    const subtotal = Number(form.subtotal) || 0;
    const freight = Number(form.freight) || 0;
    const insurance = Number(form.insurance) || 0;
    const otherFees = Number(form.other_fees) || 0;
    const total = subtotal + freight + insurance + otherFees;
    const notes = [form.notes.trim(), form.vehicle_id ? `Vehicle: ${form.vehicle_id}` : '', buildDescription()]
      .filter(Boolean)
      .join('\n---\n');
    setSubmitting(true);
    const { data, error } = await supabase
      .from('quotations')
      .insert({
        customer_id: form.customer_id,
        price_type: form.price_type,
        subtotal,
        freight,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: notes || null,
        created_by: profile.id,
      })
      .select()
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(`Could not create quotation: ${error.message}`);
      return;
    }
    toast.success('Quotation created');
    setForm(emptyForm);
    setCreateOpen(false);
    loadData();
    if (data) setSelected(data as Quotation);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      customer_id: selected.customer_id,
      vehicle_id: '',
      price_type: selected.price_type,
      subtotal: String(selected.subtotal),
      freight: String(selected.freight),
      insurance: String(selected.insurance),
      other_fees: String(selected.other_fees),
      currency: selected.currency,
      valid_until: selected.valid_until || '',
      notes: selected.notes || '',
      description: '',
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const subtotal = Number(form.subtotal) || 0;
    const freight = Number(form.freight) || 0;
    const insurance = Number(form.insurance) || 0;
    const otherFees = Number(form.other_fees) || 0;
    const total = subtotal + freight + insurance + otherFees;
    setSubmitting(true);
    const { error } = await supabase
      .from('quotations')
      .update({
        customer_id: form.customer_id,
        price_type: form.price_type,
        subtotal,
        freight,
        insurance,
        other_fees: otherFees,
        total,
        currency: form.currency,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    const updated = {
      ...selected,
      customer_id: form.customer_id,
      price_type: form.price_type,
      subtotal,
      freight,
      insurance,
      other_fees: otherFees,
      total,
      currency: form.currency,
      valid_until: form.valid_until || null,
      notes: form.notes.trim() || null,
    };
    setSelected(updated);
    setQuotations((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Quotation updated');
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('quotations').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    toast.success('Quotation deleted');
    setDeleteOpen(false);
    setSelected(null);
    loadData();
  };

  const updateStatus = async (status: Quotation['status']) => {
    if (!selected) return;
    const { error } = await supabase
      .from('quotations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...selected, status };
    setSelected(updated);
    setQuotations((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Quotation status updated');
  };

  const openPrint = () => {
    if (!selected) return;
    const desc =
      selected.notes?.split('\n---\n').pop() ||
      `${selected.price_type} quotation`;
    setPrintItems([
      {
        description: desc,
        quantity: 1,
        unit_price: selected.subtotal,
        line_total: selected.subtotal,
      },
    ]);
    setPrintOpen(true);
  };

  const stats = {
    total: quotations.length,
    sent: quotations.filter((q) => q.status === 'sent').length,
    accepted: quotations.filter((q) => q.status === 'accepted').length,
    value: quotations
      .filter((q) => q.status !== 'rejected' && q.status !== 'expired')
      .reduce((sum, q) => sum + q.total, 0),
  };

  const formFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Customer *</Label>
          <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Vehicle (optional)</Label>
          <Select value={form.vehicle_id || 'none'} onValueChange={(v) => setForm({ ...form, vehicle_id: v === 'none' ? '' : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Link vehicle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vehicle</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.make} {v.model} ({v.stock_number})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Price type</Label>
          <Select
            value={form.price_type}
            onValueChange={(v: Quotation['price_type']) => setForm({ ...form, price_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FOB">FOB</SelectItem>
              <SelectItem value="CNF">C&F / CNF</SelectItem>
              <SelectItem value="CIF">CIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valid until</Label>
          <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Vehicle / unit price (subtotal)</Label>
          <Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Freight</Label>
          <Input type="number" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Insurance</Label>
          <Input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Other fees</Label>
          <Input type="number" value={form.other_fees} onChange={(e) => setForm({ ...form, other_fees: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Line description (optional override)</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          placeholder="Auto-filled from vehicle if linked"
        />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="FOB / C&F / CIF quotes with print layout matching commercial invoices"
        actions={
          <Button size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            New quotation
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total quotations', value: stats.total },
          { label: 'Sent', value: stats.sent },
          { label: 'Accepted', value: stats.accepted },
          { label: 'Pipeline value', value: stats.value.toLocaleString() },
        ].map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotation code..." />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading quotations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">No quotations found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create a quotation for your customer.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {filtered.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelected(q)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{q.quotation_code}</p>
                    <Badge variant="outline" className={statusStyles[q.status]}>
                      {q.status}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {q.price_type}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(q.customer_id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {q.currency} {q.total.toLocaleString()}
                  </p>
                  {q.valid_until && (
                    <p className="text-xs text-muted-foreground">
                      Valid until {format(new Date(q.valid_until), 'MMM d')}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New quotation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitQuotation} className="space-y-4">
            {formFields}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.customer_id}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create quotation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit quotation</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            {formFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selected) && !printOpen} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle>{selected.quotation_code}</SheetTitle>
                <SheetDescription>
                  {customerName(selected.customer_id)} · {selected.price_type}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button size="sm" variant="outline" onClick={openPrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </Button>
                <Button size="sm" variant="outline" onClick={openEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={selected.status} onValueChange={(v: Quotation['status']) => updateStatus(v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {selected.currency} {selected.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Freight</span>
                    <span>
                      {selected.currency} {selected.freight.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Insurance</span>
                    <span>
                      {selected.currency} {selected.insurance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Other fees</span>
                    <span>
                      {selected.currency} {selected.other_fees.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                    <span>Total</span>
                    <span>
                      {selected.currency} {selected.total.toLocaleString()}
                    </span>
                  </div>
                </div>
                {selected.valid_until && (
                  <p className="text-sm text-muted-foreground">
                    Valid until: {format(new Date(selected.valid_until), 'MMM d, yyyy')}
                  </p>
                )}
                {selected.notes && (
                  <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {selected.notes}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl print:max-w-none print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Print quotation</DialogTitle>
          </DialogHeader>
          {selected && (
            <CommercialQuotationTemplate
              quotation={selected}
              items={printItems}
              customer={customerOf(selected.customer_id)}
            />
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Print / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete quotation?"
        description="This will permanently remove the quotation."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
