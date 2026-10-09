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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Payment, Customer, Invoice } from '@/lib/types';
import { ChevronRight, Landmark, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

const statusStyles: Record<Payment['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', received: 'bg-emerald-50 text-emerald-700 border-emerald-200', reconciled: 'bg-blue-50 text-blue-700 border-blue-200', rejected: 'bg-red-50 text-red-700 border-red-200',
};
const emptyForm = { customer_id: '', invoice_id: '', payment_date: '', amount: '', currency: 'JPY', exchange_rate: '1', payment_method: 'bank_transfer' as NonNullable<Payment['payment_method']>, bank_reference: '', notes: '' };

export default function PaymentsPage() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes, iRes] = await Promise.all([
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('customers').select('id, full_name, customer_code').order('full_name'),
      supabase.from('invoices').select('id, invoice_code, total, currency').order('created_at', { ascending: false }),
    ]);
    if (pRes.error) toast.error(`Unable to load payments: ${pRes.error.message}`);
    else setPayments((pRes.data || []) as Payment[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (iRes.data) setInvoices(iRes.data as Invoice[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = !q || [p.payment_code, p.bank_reference].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [payments, search, statusFilter]);

  const customerName = (id: string | null) => id ? customers.find((c) => c.id === id)?.full_name || 'Unknown' : '';
  const invoiceCode = (id: string | null) => id ? invoices.find((i) => i.id === id)?.invoice_code || '' : '';

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const amount = Number(form.amount) || 0;
    const rate = Number(form.exchange_rate) || 1;
    setSubmitting(true);
    const { error } = await supabase.from('payments').insert({
      customer_id: form.customer_id || null, invoice_id: form.invoice_id || null,
      payment_date: form.payment_date || new Date().toISOString().split('T')[0], amount, currency: form.currency,
      exchange_rate: rate, amount_jpy: amount * rate, payment_method: form.payment_method, bank_reference: form.bank_reference.trim() || null,
      notes: form.notes.trim() || null, created_by: profile.id,
    });
    setSubmitting(false);
    if (error) { toast.error(`Could not record payment: ${error.message}`); return; }
    toast.success('Payment recorded'); setForm(emptyForm); setCreateOpen(false); loadData();
  };

  const openEdit = () => { if (!selected) return; setForm({ customer_id: selected.customer_id || '', invoice_id: selected.invoice_id || '', payment_date: selected.payment_date, amount: String(selected.amount), currency: selected.currency, exchange_rate: String(selected.exchange_rate), payment_method: selected.payment_method || 'bank_transfer', bank_reference: selected.bank_reference || '', notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(form.amount) || 0;
    const rate = Number(form.exchange_rate) || 1;
    setSubmitting(true);
    const { error } = await supabase.from('payments').update({ customer_id: form.customer_id || null, invoice_id: form.invoice_id || null, payment_date: form.payment_date, amount, currency: form.currency, exchange_rate: rate, amount_jpy: amount * rate, payment_method: form.payment_method, bank_reference: form.bank_reference.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, customer_id: form.customer_id || null, invoice_id: form.invoice_id || null, amount, currency: form.currency, exchange_rate: rate, amount_jpy: amount * rate, payment_method: form.payment_method, bank_reference: form.bank_reference.trim() || null };
    setSelected(updated); setPayments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Payment updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('payments').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Payment deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updatePaymentStatus = async (status: Payment['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('payments').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setPayments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Payment status updated');
  };

  const stats = { total: payments.length, received: payments.filter((p) => p.status === 'received').length, reconciled: payments.filter((p) => p.status === 'reconciled').length, totalJpy: payments.filter((p) => p.status !== 'rejected').reduce((sum, p) => sum + p.amount_jpy, 0) };

  return (
    <div className="space-y-6">
      <PageHeader title="Payments / T/T Remittances" description="Track bank transfers, allocate payments, and reconcile receipts" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Record payment</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total payments', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Received', value: stats.received, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Reconciled', value: stats.reconciled, tone: 'bg-cyan-50 text-cyan-600' }, { label: 'Total (JPY)', value: stats.totalJpy.toLocaleString(), tone: 'bg-amber-50 text-amber-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payment code, bank ref..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading payments...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Landmark className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No payments found</h3><p className="mt-1 text-sm text-muted-foreground">Record a payment or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((p) => <button key={p.id} onClick={() => setSelected(p)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.payment_code}</p><Badge variant="outline" className={statusStyles[p.status]}>{p.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(p.customer_id)}{invoiceCode(p.invoice_id) ? ` · ${invoiceCode(p.invoice_id)}` : ''}{p.bank_reference ? ` · ${p.bank_reference}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold">{p.currency} {p.amount.toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(p.payment_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader><form onSubmit={submitPayment} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Invoice</Label><Select value={form.invoice_id} onValueChange={(v) => setForm({ ...form, invoice_id: v })}><SelectTrigger><SelectValue placeholder="Allocate to invoice" /></SelectTrigger><SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Payment date</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div><div className="space-y-2"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Exchange rate</Label><Input type="number" step="0.0001" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} /></div><div className="space-y-2"><Label>Payment method</Label><Select value={form.payment_method} onValueChange={(v: NonNullable<Payment['payment_method']>) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Bank reference</Label><Input value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} /></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Record payment'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit payment</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Invoice</Label><Select value={form.invoice_id} onValueChange={(v) => setForm({ ...form, invoice_id: v })}><SelectTrigger><SelectValue placeholder="Allocate to invoice" /></SelectTrigger><SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Payment date</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div><div className="space-y-2"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Exchange rate</Label><Input type="number" step="0.0001" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} /></div><div className="space-y-2"><Label>Payment method</Label><Select value={form.payment_method} onValueChange={(v: NonNullable<Payment['payment_method']>) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Bank reference</Label><Input value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} /></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.payment_code}</SheetTitle><SheetDescription>{customerName(selected.customer_id)}{invoiceCode(selected.invoice_id) ? ` · ${invoiceCode(selected.invoice_id)}` : ''}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Status:</span><Select value={selected.status} onValueChange={(v: Payment['status']) => updatePaymentStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="reconciled">Reconciled</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount</p><p className="mt-1 text-sm font-semibold">{selected.currency} {selected.amount.toLocaleString()}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount (JPY)</p><p className="mt-1 text-sm font-semibold">{selected.amount_jpy.toLocaleString()}</p></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</p><p className="mt-1 text-sm">{format(new Date(selected.payment_date), 'MMM d, yyyy')}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Method</p><p className="mt-1 text-sm capitalize">{selected.payment_method?.replace('_', ' ') || 'N/A'}</p></div></div>{selected.bank_reference && <p className="text-sm text-muted-foreground">Bank ref: {selected.bank_reference}</p>}{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div></>}</></SheetContent></Sheet>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete payment?" description="This will permanently remove the payment record. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
