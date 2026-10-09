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
import type { Invoice, Customer, Sale } from '@/lib/types';
import { ChevronRight, FileText, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Invoice['payment_status'], string> = {
  unpaid: 'bg-red-50 text-red-700 border-red-200', partial: 'bg-amber-50 text-amber-700 border-amber-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-slate-100 text-slate-600 border-slate-200', credited: 'bg-blue-50 text-blue-700 border-blue-200',
};
const typeLabels: Record<Invoice['invoice_type'], string> = { proforma: 'Proforma', commercial: 'Commercial', credit_note: 'Credit Note' };
const emptyForm = { customer_id: '', sale_id: '', invoice_type: 'commercial' as Invoice['invoice_type'], issue_date: '', due_date: '', subtotal: '', tax: '', currency: 'JPY', notes: '' };

export default function InvoicesPage() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes, sRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, full_name, customer_code').order('full_name'),
      supabase.from('sales').select('id, sale_code').order('created_at', { ascending: false }),
    ]);
    if (iRes.error) toast.error(`Unable to load invoices: ${iRes.error.message}`);
    else setInvoices((iRes.data || []) as Invoice[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (sRes.data) setSales(sRes.data as Sale[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;
      const matchesSearch = !q || [inv.invoice_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || 'Unknown';
  const saleCode = (id: string | null) => sales.find((s) => s.id === id)?.sale_code || '';

  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id) return;
    const subtotal = Number(form.subtotal) || 0;
    const tax = Number(form.tax) || 0;
    const total = subtotal + tax;
    setSubmitting(true);
    const { data, error } = await supabase.from('invoices').insert({
      customer_id: form.customer_id, sale_id: form.sale_id || null, invoice_type: form.invoice_type,
      issue_date: form.issue_date || new Date().toISOString().split('T')[0], due_date: form.due_date || null,
      subtotal, tax, total, currency: form.currency, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create invoice: ${error.message}`); return; }
    toast.success('Invoice created'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) setSelected(data as Invoice);
  };

  const updatePaymentStatus = async (payment_status: Invoice['payment_status']) => {
    if (!selected) return;
    const { error } = await supabase.from('invoices').update({ payment_status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, payment_status }; setSelected(updated);
    setInvoices((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Payment status updated');
  };

  const stats = { total: invoices.length, unpaid: invoices.filter((i) => i.payment_status === 'unpaid').length, paid: invoices.filter((i) => i.payment_status === 'paid').length, outstanding: invoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + i.total, 0) };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Proforma, commercial, and purchase invoices with PDF generation" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New invoice</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total invoices', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Unpaid', value: stats.unpaid, tone: 'bg-red-50 text-red-600' },
        { label: 'Paid', value: stats.paid, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Outstanding', value: stats.outstanding.toLocaleString(), tone: 'bg-amber-50 text-amber-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice code..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading invoices...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><FileText className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No invoices found</h3><p className="mt-1 text-sm text-muted-foreground">Create an invoice or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((inv) => <button key={inv.id} onClick={() => setSelected(inv)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{inv.invoice_code}</p><Badge variant="secondary" className="text-xs">{typeLabels[inv.invoice_type]}</Badge><Badge variant="outline" className={statusStyles[inv.payment_status]}>{inv.payment_status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(inv.customer_id)}{saleCode(inv.sale_id) ? ` · ${saleCode(inv.sale_id)}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold">{inv.currency} {inv.total.toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader><form onSubmit={submitInvoice} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer *</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Sale (optional)</Label><Select value={form.sale_id} onValueChange={(v) => setForm({ ...form, sale_id: v })}><SelectTrigger><SelectValue placeholder="Link to sale" /></SelectTrigger><SelectContent>{sales.map((s) => <SelectItem key={s.id} value={s.id}>{s.sale_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Invoice type</Label><Select value={form.invoice_type} onValueChange={(v: Invoice['invoice_type']) => setForm({ ...form, invoice_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="proforma">Proforma</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="credit_note">Credit Note</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Subtotal</Label><Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div><div className="space-y-2"><Label>Tax</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.customer_id}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create invoice'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.invoice_code}</SheetTitle><SheetDescription>{customerName(selected.customer_id)} · {typeLabels[selected.invoice_type]}</SheetDescription></SheetHeader><div className="space-y-4 pt-6"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Payment:</span><Select value={selected.payment_status} onValueChange={(v: Invoice['payment_status']) => updatePaymentStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{selected.currency} {selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{selected.currency} {selected.tax.toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total</span><span>{selected.currency} {selected.total.toLocaleString()}</span></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Issue date</p><p className="mt-1 text-sm">{format(new Date(selected.issue_date), 'MMM d, yyyy')}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Due date</p><p className="mt-1 text-sm">{selected.due_date ? format(new Date(selected.due_date), 'MMM d, yyyy') : 'Not set'}</p></div></div>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div></>}</></SheetContent></Sheet>
    </div>
  );
}
