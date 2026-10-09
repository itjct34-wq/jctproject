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
import type { Expense, Vehicle } from '@/lib/types';
import { CheckCircle2, ChevronRight, Loader2, Pencil, Plus, Receipt, Search, Trash2, Wallet, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from 'sonner';

const statusStyles: Record<Expense['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200', rejected: 'bg-red-50 text-red-700 border-red-200', paid: 'bg-blue-50 text-blue-700 border-blue-200',
};
const emptyForm = { category: '', vehicle_id: '', expense_date: '', amount: '', currency: 'JPY', payment_method: 'bank_transfer' as NonNullable<Expense['payment_method']>, vendor: '', notes: '' };

export default function ExpensesPage() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [eRes, vRes] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('vehicles').select('id, stock_number, make, model').order('created_at', { ascending: false }),
    ]);
    if (eRes.error) toast.error(`Unable to load expenses: ${eRes.error.message}`);
    else setExpenses((eRes.data || []) as Expense[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const categories = useMemo(() => Array.from(new Set(expenses.map((e) => e.category))).sort(), [expenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesSearch = !q || [e.expense_code, e.vendor, e.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [expenses, search, statusFilter, categoryFilter]);

  const vehicleLabel = (id: string | null) => { const v = vehicles.find((v) => v.id === id); return v ? `${v.make} ${v.model} (${v.stock_number})` : ''; };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.category.trim() || !form.amount) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('expenses').insert({
      category: form.category.trim(), vehicle_id: form.vehicle_id || null,
      expense_date: form.expense_date || new Date().toISOString().split('T')[0],
      amount: Number(form.amount) || 0, currency: form.currency, payment_method: form.payment_method,
      vendor: form.vendor.trim() || null, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create expense: ${error.message}`); return; }
    toast.success('Expense recorded'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) setSelected(data as Expense);
  };

  const openEdit = () => { if (!selected) return; setForm({ category: selected.category, vehicle_id: selected.vehicle_id || '', expense_date: selected.expense_date, amount: String(selected.amount), currency: selected.currency, payment_method: selected.payment_method || 'bank_transfer', vendor: selected.vendor || '', notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('expenses').update({ category: form.category.trim(), vehicle_id: form.vehicle_id || null, expense_date: form.expense_date, amount: Number(form.amount) || 0, currency: form.currency, payment_method: form.payment_method, vendor: form.vendor.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, category: form.category.trim(), amount: Number(form.amount) || 0, currency: form.currency, vendor: form.vendor.trim() || null, notes: form.notes.trim() || null };
    setSelected(updated); setExpenses((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Expense updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Expense deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const approveExpense = async () => {
    if (!selected || !profile) return;
    const { error } = await supabase.from('expenses').update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status: 'approved' as const }; setSelected(updated);
    setExpenses((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Expense approved');
  };

  const rejectExpense = async () => {
    if (!selected) return;
    const { error } = await supabase.from('expenses').update({ status: 'rejected' }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status: 'rejected' as const }; setSelected(updated);
    setExpenses((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Expense rejected');
  };

  const markPaid = async () => {
    if (!selected) return;
    const { error } = await supabase.from('expenses').update({ status: 'paid' }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status: 'paid' as const }; setSelected(updated);
    setExpenses((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Expense marked as paid');
  };

  const stats = { total: expenses.length, pending: expenses.filter((e) => e.status === 'pending').length, approved: expenses.filter((e) => e.status === 'approved').length, totalAmount: expenses.filter((e) => e.status === 'paid' || e.status === 'approved').reduce((sum, e) => sum + e.amount, 0) };

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts & Expenses" description="Track income, expenses, receivables, and payables" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New expense</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total expenses', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Pending', value: stats.pending, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Approved', value: stats.approved, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Total amount', value: stats.totalAmount.toLocaleString(), tone: 'bg-cyan-50 text-cyan-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, vendor, category..." /></div><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading expenses...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Wallet className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No expenses found</h3><p className="mt-1 text-sm text-muted-foreground">Record an expense or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((e) => <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Receipt className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{e.expense_code}</p><Badge variant="outline" className={statusStyles[e.status]}>{e.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{e.category}{e.vendor ? ` · ${e.vendor}` : ''}{vehicleLabel(e.vehicle_id) ? ` · ${vehicleLabel(e.vehicle_id)}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold">{e.currency} {e.amount.toLocaleString()}</p><p className="text-xs text-muted-foreground">{format(new Date(e.expense_date), 'MMM d, yyyy')}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader><form onSubmit={submitExpense} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category *</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required placeholder="Transport, auction fees, repair..." /></div><div className="space-y-2"><Label>Vehicle</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Link to vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Expense date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div><div className="space-y-2"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Payment method</Label><Select value={form.payment_method} onValueChange={(v: NonNullable<Expense['payment_method']>) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.category.trim() || !form.amount}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create expense'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{selected.expense_code}</SheetTitle><SheetDescription>{selected.category}{selected.vendor ? ` · ${selected.vendor}` : ''}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amount</p><p className="mt-1 text-sm font-semibold">{selected.currency} {selected.amount.toLocaleString()}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</p><p className="mt-1 text-sm">{format(new Date(selected.expense_date), 'MMM d, yyyy')}</p></div></div>{vehicleLabel(selected.vehicle_id) && <p className="text-sm text-muted-foreground">Vehicle: {vehicleLabel(selected.vehicle_id)}</p>}{selected.payment_method && <p className="text-sm text-muted-foreground">Method: {selected.payment_method.replace('_', ' ')}</p>}{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}{selected.status === 'pending' && <div className="flex gap-2"><Button size="sm" className="flex-1" onClick={approveExpense}><CheckCircle2 className="mr-1.5 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" className="flex-1" onClick={rejectExpense}><XCircle className="mr-1.5 h-4 w-4" />Reject</Button></div>}{selected.status === 'approved' && <Button size="sm" className="w-full" onClick={markPaid}>Mark as paid</Button>}</div></>}</></SheetContent></Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit expense</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category *</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></div><div className="space-y-2"><Label>Vehicle</Label><Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}><SelectTrigger><SelectValue placeholder="Link to vehicle" /></SelectTrigger><SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.stock_number})</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Expense date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div><div className="space-y-2"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Payment method</Label><Select value={form.payment_method} onValueChange={(v: NonNullable<Expense['payment_method']>) => setForm({ ...form, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete expense?" description="This will permanently remove the expense record. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
