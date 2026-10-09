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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { exportToExcel } from '@/lib/utils/excel-export';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { Invoice, InvoiceItem, Customer, Sale, Vehicle } from '@/lib/types';
import { ChevronRight, Download, FileText, Loader2, Pencil, Plus, Search, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Invoice['payment_status'], string> = {
  unpaid: 'bg-red-50 text-red-700 border-red-200', partial: 'bg-amber-50 text-amber-700 border-amber-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-slate-100 text-slate-600 border-slate-200', credited: 'bg-blue-50 text-blue-700 border-blue-200',
};
const typeLabels: Record<Invoice['invoice_type'], string> = { proforma: 'Proforma', commercial: 'Commercial', credit_note: 'Credit Note' };
const emptyForm = { customer_id: '', sale_id: '', invoice_type: 'commercial' as Invoice['invoice_type'], issue_date: '', due_date: '', tax: '', currency: 'JPY', notes: '' };
const emptyItem = { description: '', quantity: '1', unit_price: '', discount: '0' };

export default function InvoicesPage() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lineItems, setLineItems] = useState<Array<{ description: string; quantity: string; unit_price: string; discount: string }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes, sRes, vRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, full_name, customer_code').order('full_name'),
      supabase.from('sales').select('id, sale_code').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('id, stock_number, make, model, chassis_number').order('created_at', { ascending: false }),
    ]);
    if (iRes.error) toast.error(`Unable to load invoices: ${iRes.error.message}`);
    else setInvoices((iRes.data || []) as Invoice[]);
    if (cRes.data) setCustomers(cRes.data as Customer[]);
    if (sRes.data) setSales(sRes.data as Sale[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
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
  const saleCode = (id: string | null) => id ? sales.find((s) => s.id === id)?.sale_code || '' : '';

  const calcSubtotal = (items: Array<{ quantity: string; unit_price: string; discount: string }>) => items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0; const price = Number(item.unit_price) || 0; const disc = Number(item.discount) || 0;
    return sum + (qty * price - disc);
  }, 0);

  const loadDetails = async (inv: Invoice) => {
    setSelected(inv); setDetailLoading(true);
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order', { ascending: true });
    if (error) toast.error(`Could not load line items: ${error.message}`);
    setItems((data || []) as InvoiceItem[]); setDetailLoading(false);
  };

  const openCreate = () => { setForm(emptyForm); setLineItems([{ ...emptyItem }]); setCreateOpen(true); };
  const openEdit = () => {
    if (!selected) return;
    setForm({ customer_id: selected.customer_id, sale_id: selected.sale_id || '', invoice_type: selected.invoice_type, issue_date: selected.issue_date, due_date: selected.due_date || '', tax: String(selected.tax), currency: selected.currency, notes: selected.notes || '' });
    setLineItems(items.map((i) => ({ description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price), discount: String(i.discount) })));
    if (items.length === 0) setLineItems([{ ...emptyItem }]);
    setEditOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.customer_id) return;
    setSubmitting(true);
    const subtotal = calcSubtotal(lineItems);
    const tax = Number(form.tax) || 0;
    const total = subtotal + tax;
    const { data, error } = await supabase.from('invoices').insert({ customer_id: form.customer_id, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date || new Date().toISOString().split('T')[0], due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, payment_status: 'unpaid', notes: form.notes.trim() || null, created_by: profile.id }).select().maybeSingle();
    if (error) { setSubmitting(false); toast.error(`Could not create invoice: ${error.message}`); return; }
    const inv = data as Invoice;
    if (lineItems.filter((i) => i.description.trim()).length > 0) {
      const itemRows = lineItems.filter((i) => i.description.trim()).map((item, idx) => ({ invoice_id: inv.id, description: item.description.trim(), quantity: Number(item.quantity) || 1, unit_price: Number(item.unit_price) || 0, discount: Number(item.discount) || 0, line_total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0) - (Number(item.discount) || 0), sort_order: idx }));
      const { error: itemError } = await supabase.from('invoice_items').insert(itemRows);
      if (itemError) toast.error(`Invoice created but line items failed: ${itemError.message}`);
    }
    setSubmitting(false); toast.success('Invoice created'); setForm(emptyForm); setLineItems([{ ...emptyItem }]); setCreateOpen(false); loadData(); await loadDetails(inv);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const subtotal = calcSubtotal(lineItems);
    const tax = Number(form.tax) || 0;
    const total = subtotal + tax;
    const { error } = await supabase.from('invoices').update({ customer_id: form.customer_id, sale_id: form.sale_id || null, invoice_type: form.invoice_type, issue_date: form.issue_date, due_date: form.due_date || null, subtotal, tax, total, currency: form.currency, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { setSubmitting(false); toast.error(`Could not update: ${error.message}`); return; }
    await supabase.from('invoice_items').delete().eq('invoice_id', selected.id);
    if (lineItems.filter((i) => i.description.trim()).length > 0) {
      const itemRows = lineItems.filter((i) => i.description.trim()).map((item, idx) => ({ invoice_id: selected.id, description: item.description.trim(), quantity: Number(item.quantity) || 1, unit_price: Number(item.unit_price) || 0, discount: Number(item.discount) || 0, line_total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0) - (Number(item.discount) || 0), sort_order: idx }));
      await supabase.from('invoice_items').insert(itemRows);
    }
    setSubmitting(false);
    const updated = { ...selected, subtotal, tax, total, customer_id: form.customer_id, invoice_type: form.invoice_type, due_date: form.due_date || null, notes: form.notes.trim() || null };
    setSelected(updated); setInvoices((items) => items.map((i) => i.id === updated.id ? updated : i));
    await loadDetails(updated); toast.success('Invoice updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('invoices').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Invoice deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updatePaymentStatus = async (payment_status: Invoice['payment_status']) => {
    if (!selected) return;
    const { error } = await supabase.from('invoices').update({ payment_status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, payment_status }; setSelected(updated);
    setInvoices((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Payment status updated');
  };

  const isDraft = selected && selected.payment_status === 'unpaid';
  const hasPayments = selected && (selected.payment_status === 'paid' || selected.payment_status === 'partial');

  const handleExport = async () => {
    const rows = filtered.map((i) => ({ code: i.invoice_code, customer: customerName(i.customer_id), type: typeLabels[i.invoice_type], issue: format(new Date(i.issue_date), 'yyyy-MM-dd'), due: i.due_date ? format(new Date(i.due_date), 'yyyy-MM-dd') : '', subtotal: i.subtotal, tax: i.tax, total: i.total, currency: i.currency, status: i.payment_status }));
    await exportToExcel('invoices-export', 'Invoices', [
      { header: 'Invoice #', key: 'code', width: 18 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Type', key: 'type', width: 14 }, { header: 'Issue Date', key: 'issue', width: 14 }, { header: 'Due Date', key: 'due', width: 14 }, { header: 'Subtotal', key: 'subtotal', width: 14, format: '#,##0' }, { header: 'Tax', key: 'tax', width: 12, format: '#,##0' }, { header: 'Total', key: 'total', width: 14, format: '#,##0' }, { header: 'Currency', key: 'currency', width: 10 }, { header: 'Status', key: 'status', width: 12 },
    ], rows, { title: 'Invoice Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length) } });
    toast.success('Invoices exported');
  };

  const printInvoice = () => { setPrintOpen(true); };

  const stats = { total: invoices.length, unpaid: invoices.filter((i) => i.payment_status === 'unpaid').length, paid: invoices.filter((i) => i.payment_status === 'paid').length, outstanding: invoices.filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial').reduce((sum, i) => sum + i.total, 0) };

  const lineItemForm = (isOpen: boolean, onClose: () => void, onSubmit: (e: React.FormEvent) => void, title: string) => (
    <Dialog open={isOpen} onOpenChange={onClose}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><form onSubmit={onSubmit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Customer *</Label><Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Sale (optional)</Label><Select value={form.sale_id} onValueChange={(v) => setForm({ ...form, sale_id: v })}><SelectTrigger><SelectValue placeholder="Link to sale" /></SelectTrigger><SelectContent>{sales.map((s) => <SelectItem key={s.id} value={s.id}>{s.sale_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Invoice type</Label><Select value={form.invoice_type} onValueChange={(v: Invoice['invoice_type']) => setForm({ ...form, invoice_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="proforma">Proforma</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="credit_note">Credit Note</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div><div className="space-y-2"><Label>Tax</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div></div><div className="space-y-2"><div className="flex items-center justify-between"><Label>Line items</Label><Button type="button" size="sm" variant="outline" onClick={() => setLineItems([...lineItems, { ...emptyItem }])}><Plus className="mr-1 h-3.5 w-3.5" />Add line</Button></div><div className="space-y-2">{lineItems.map((item, idx) => (<div key={idx} className="grid grid-cols-12 gap-2 items-end"><div className="col-span-5"><Input value={item.description} onChange={(e) => { const next = [...lineItems]; next[idx] = { ...item, description: e.target.value }; setLineItems(next); }} placeholder="Description" /></div><div className="col-span-2"><Input type="number" value={item.quantity} onChange={(e) => { const next = [...lineItems]; next[idx] = { ...item, quantity: e.target.value }; setLineItems(next); }} placeholder="Qty" /></div><div className="col-span-2"><Input type="number" value={item.unit_price} onChange={(e) => { const next = [...lineItems]; next[idx] = { ...item, unit_price: e.target.value }; setLineItems(next); }} placeholder="Unit price" /></div><div className="col-span-2"><Input type="number" value={item.discount} onChange={(e) => { const next = [...lineItems]; next[idx] = { ...item, discount: e.target.value }; setLineItems(next); }} placeholder="Discount" /></div><div className="col-span-1"><Button type="button" size="sm" variant="ghost" onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>))}</div></div><div className="rounded-lg bg-muted/50 p-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{form.currency} {calcSubtotal(lineItems).toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{form.currency} {(Number(form.tax) || 0).toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total</span><span>{form.currency} {(calcSubtotal(lineItems) + (Number(form.tax) || 0)).toLocaleString()}</span></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting || !form.customer_id}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : title.includes('Edit') ? 'Save changes' : 'Create invoice'}</Button></DialogFooter></form></DialogContent></Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Proforma, commercial, and purchase invoices with PDF generation" actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export</Button><Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />New invoice</Button></div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total invoices', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Unpaid', value: stats.unpaid, tone: 'bg-red-50 text-red-600' }, { label: 'Paid', value: stats.paid, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Outstanding', value: stats.outstanding.toLocaleString(), tone: 'bg-amber-50 text-amber-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice code..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading invoices...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><FileText className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No invoices found</h3><p className="mt-1 text-sm text-muted-foreground">Create an invoice or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((inv) => <button key={inv.id} onClick={() => loadDetails(inv)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{inv.invoice_code}</p><Badge variant="secondary" className="text-xs">{typeLabels[inv.invoice_type]}</Badge><Badge variant="outline" className={statusStyles[inv.payment_status]}>{inv.payment_status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{customerName(inv.customer_id)}{saleCode(inv.sale_id) ? ` · ${saleCode(inv.sale_id)}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold">{inv.currency} {inv.total.toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      {lineItemForm(createOpen, () => setCreateOpen(false), submitCreate, 'New invoice')}
      {lineItemForm(editOpen, () => setEditOpen(false), submitEdit, 'Edit invoice')}
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete invoice?" description={hasPayments ? 'This invoice has payments. Deleting it will not delete the payment records, but the invoice will be removed. Consider cancelling instead.' : 'This will permanently delete the invoice and its line items. This action cannot be undone.'} confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.invoice_code}</SheetTitle><SheetDescription>{customerName(selected.customer_id)} · {typeLabels[selected.invoice_type]}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2">{isDraft && <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}<Button size="sm" variant="outline" onClick={printInvoice}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>{(isDraft || !hasPayments) && <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>}</div>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div> : <div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Payment:</span><Select value={selected.payment_status} onValueChange={(v: Invoice['payment_status']) => updatePaymentStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select></div>{items.length > 0 && <Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit_price.toLocaleString()}</TableCell><TableCell className="text-right">{item.line_total.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>}<div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{selected.currency} {selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{selected.currency} {selected.tax.toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-2 text-sm font-bold"><span>Total</span><span>{selected.currency} {selected.total.toLocaleString()}</span></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Issue date</p><p className="mt-1 text-sm">{format(new Date(selected.issue_date), 'MMM d, yyyy')}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Due date</p><p className="mt-1 text-sm">{selected.due_date ? format(new Date(selected.due_date), 'MMM d, yyyy') : 'Not set'}</p></div></div>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div>}</>}</></SheetContent></Sheet>
      <Dialog open={printOpen} onOpenChange={setPrintOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Print preview — {selected?.invoice_code}</DialogTitle></DialogHeader>{selected && <div className="rounded-lg border border-border p-6 bg-white print:border-0"><div className="flex justify-between mb-6"><div><h2 className="text-xl font-bold">Japan Circular Trading Co., Ltd.</h2><p className="text-xs text-muted-foreground mt-1">Used Vehicle Export Division</p></div><div className="text-right"><h3 className="text-lg font-bold uppercase">{typeLabels[selected.invoice_type]}</h3><p className="text-sm">{selected.invoice_code}</p></div></div><div className="grid grid-cols-2 gap-4 mb-6"><div><p className="text-xs uppercase text-muted-foreground">Bill To</p><p className="font-medium mt-1">{customerName(selected.customer_id)}</p></div><div className="text-right"><p className="text-xs"><span className="text-muted-foreground">Issue: </span>{format(new Date(selected.issue_date), 'MMM d, yyyy')}</p>{selected.due_date && <p className="text-xs"><span className="text-muted-foreground">Due: </span>{format(new Date(selected.due_date), 'MMM d, yyyy')}</p>}</div></div>{items.length > 0 && <Table className="mb-4"><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Disc</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.description}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{item.unit_price.toLocaleString()}</TableCell><TableCell className="text-right">{item.discount.toLocaleString()}</TableCell><TableCell className="text-right">{item.line_total.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>}<div className="ml-auto w-64 space-y-1"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{selected.currency} {selected.subtotal.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{selected.currency} {selected.tax.toLocaleString()}</span></div><div className="flex justify-between border-t border-border pt-1 font-bold"><span>Total</span><span>{selected.currency} {selected.total.toLocaleString()}</span></div></div>{selected.notes && <p className="mt-6 text-xs text-muted-foreground">{selected.notes}</p>}</div>}<DialogFooter><Button variant="outline" onClick={() => setPrintOpen(false)}>Close</Button><Button onClick={() => window.print()}>Print</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
