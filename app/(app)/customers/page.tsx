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
import { exportToExcel } from '@/lib/utils/excel-export';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { Customer, CustomerCommunication, CustomerContact, CustomerRequirement } from '@/lib/types';
import { CarFront, Check, ChevronRight, CircleUserRound, Download, FileText, Loader2, Mail, MessageSquare, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Customer['status'], string> = {
  lead: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-emerald-50 text-emerald-700 border-emerald-200', inactive: 'bg-slate-100 text-slate-600 border-slate-200', blocked: 'bg-red-50 text-red-700 border-red-200',
};
const emptyForm = { full_name: '', company_name: '', customer_type: 'individual' as Customer['customer_type'], email: '', phone: '', whatsapp: '', country: '', city: '', source: 'website', status: 'lead' as Customer['status'], notes: '' };

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [requirements, setRequirements] = useState<CustomerRequirement[]>([]);
  const [communications, setCommunications] = useState<CustomerCommunication[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [requirementForm, setRequirementForm] = useState({ make: '', model: '', year_from: '', year_to: '', budget_min: '', budget_max: '', currency: 'JPY', notes: '' });
  const [communicationForm, setCommunicationForm] = useState({ communication_type: 'note' as CustomerCommunication['communication_type'], subject: '', body: '' });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('customers').select('*').order('updated_at', { ascending: false });
    if (error) toast.error(`Unable to load customers: ${error.message}`);
    else setCustomers((data || []) as Customer[]);
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (customer: Customer) => {
    setSelected(customer);
    setDetailLoading(true);
    const [cRes, rRes, comRes] = await Promise.all([
      supabase.from('customer_contacts').select('*').eq('customer_id', customer.id).order('is_primary', { ascending: false }),
      supabase.from('customer_requirements').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('customer_communications').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    ]);
    if (cRes.error || rRes.error || comRes.error) toast.error('Some customer details could not be loaded');
    setContacts((cRes.data || []) as CustomerContact[]);
    setRequirements((rRes.data || []) as CustomerRequirement[]);
    setCommunications((comRes.data || []) as CustomerCommunication[]);
    setDetailLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesSearch = !q || [c.customer_code, c.full_name, c.company_name, c.email, c.phone, c.country].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [customers, search, statusFilter]);

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };
  const openEdit = () => { if (!selected) return; setForm({ full_name: selected.full_name, company_name: selected.company_name || '', customer_type: selected.customer_type, email: selected.email || '', phone: selected.phone || '', whatsapp: selected.whatsapp || '', country: selected.country || '', city: selected.city || '', source: selected.source || 'website', status: selected.status, notes: selected.notes || '' }); setEditOpen(true); };

  const validateCustomerContact = () => {
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    if (!email && !phone) { toast.error('Enter at least one contact method: email or phone number.'); return false; }
    if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { toast.error('Enter a valid email address.'); return false; }
    if (phone && phone.replace(/\\D/g, '').length < 7) { toast.error('Enter a valid phone number with at least 7 digits.'); return false; }
    return true;
  };

  const contactDuplicateMessage = (error: { code?: string; message?: string }) => {
    if (error.code === '23505' || /customers_(email|phone)_unique/i.test(error.message || '')) {
      toast.error('A customer with this email address or phone number already exists. Use the existing customer record instead.');
      return true;
    }
    return false;
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.full_name.trim() || !validateCustomerContact()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('customers').insert({ ...form, full_name: form.full_name.trim(), company_name: form.company_name.trim() || null, email: form.email.trim().toLowerCase() || null, phone: form.phone.trim() || null, whatsapp: form.whatsapp.trim() || null, country: form.country.trim() || null, city: form.city.trim() || null, notes: form.notes.trim() || null, assigned_to: profile.id, created_by: profile.id }).select().maybeSingle();
    setSubmitting(false);
    if (error) { if (!contactDuplicateMessage(error)) toast.error(`Could not create customer: ${error.message}`); return; }
    toast.success('Customer added to CRM'); setForm(emptyForm); setCreateOpen(false); await loadCustomers();
    if (data) await loadDetails(data as Customer);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !form.full_name.trim() || !validateCustomerContact()) return;
    setSubmitting(true);
    const { error } = await supabase.from('customers').update({ full_name: form.full_name.trim(), company_name: form.company_name.trim() || null, customer_type: form.customer_type, email: form.email.trim().toLowerCase() || null, phone: form.phone.trim() || null, whatsapp: form.whatsapp.trim() || null, country: form.country.trim() || null, city: form.city.trim() || null, source: form.source, status: form.status, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { if (!contactDuplicateMessage(error)) toast.error(`Could not update customer: ${error.message}`); return; }
    const updated = { ...selected, ...form, full_name: form.full_name.trim() };
    setSelected(updated); setCustomers((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Customer updated'); setEditOpen(false);
  };

  const checkDelete = async () => {
    if (!selected) return;
    setDeleteOpen(true); setDeleteChecking(true); setDeleteBlocked(null);
    const [salesRes, invoicesRes, paymentsRes, shipmentsRes] = await Promise.all([
      supabase.from('sales').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
    ]);
    const counts = { sales: salesRes.count || 0, invoices: invoicesRes.count || 0, payments: paymentsRes.count || 0, quotations: shipmentsRes.count || 0 };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const parts: string[] = [];
      if (counts.sales) parts.push(`${counts.sales} sale(s)`);
      if (counts.invoices) parts.push(`${counts.invoices} invoice(s)`);
      if (counts.payments) parts.push(`${counts.payments} payment(s)`);
      if (counts.quotations) parts.push(`${counts.quotations} quotation(s)`);
      setDeleteBlocked(`This customer has ${parts.join(', ')}. Archive them instead to preserve history.`);
    }
    setDeleteChecking(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('customers').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Customer deleted'); setDeleteOpen(false); setSelected(null); await loadCustomers();
  };

  const archiveCustomer = async () => {
    if (!selected) return;
    const { error } = await supabase.from('customers').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status: 'inactive' as const };
    setSelected(updated); setCustomers((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Customer archived'); setDeleteOpen(false);
  };

  const updateStatus = async (status: Customer['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('customers').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setCustomers((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Status updated');
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !contactForm.name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_contacts').insert({ customer_id: selected.id, name: contactForm.name.trim(), email: contactForm.email.trim() || null, phone: contactForm.phone.trim() || null, role: contactForm.role.trim() || null });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setContactForm({ name: '', email: '', phone: '', role: '' }); setContactOpen(false); await loadDetails(selected); toast.success('Contact added');
  };

  const submitRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_requirements').insert({ customer_id: selected.id, make: requirementForm.make.trim() || null, model: requirementForm.model.trim() || null, year_from: requirementForm.year_from ? Number(requirementForm.year_from) : null, year_to: requirementForm.year_to ? Number(requirementForm.year_to) : null, budget_min: requirementForm.budget_min ? Number(requirementForm.budget_min) : null, budget_max: requirementForm.budget_max ? Number(requirementForm.budget_max) : null, currency: requirementForm.currency, notes: requirementForm.notes.trim() || null, created_by: profile.id });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setRequirementForm({ make: '', model: '', year_from: '', year_to: '', budget_min: '', budget_max: '', currency: 'JPY', notes: '' }); setRequirementOpen(false); await loadDetails(selected); toast.success('Requirement added');
  };

  const submitCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selected || !communicationForm.subject.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_communications').insert({ customer_id: selected.id, communication_type: communicationForm.communication_type, subject: communicationForm.subject.trim(), body: communicationForm.body.trim() || null, created_by: profile.id });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setCommunicationForm({ communication_type: 'note', subject: '', body: '' }); setCommunicationOpen(false); await loadDetails(selected); toast.success('Interaction logged');
  };

  const handleExport = async () => {
    const rows = filtered.map((c) => ({ code: c.customer_code, name: c.full_name, company: c.company_name || '', type: c.customer_type, email: c.email || '', phone: c.phone || '', country: c.country || '', city: c.city || '', status: c.status, source: c.source || '', created: format(new Date(c.created_at), 'yyyy-MM-dd') }));
    await exportToExcel('customers-export', 'Customers', [
      { header: 'Customer Code', key: 'code', width: 16 }, { header: 'Name', key: 'name', width: 24 }, { header: 'Company', key: 'company', width: 24 }, { header: 'Type', key: 'type', width: 12 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Phone', key: 'phone', width: 18 }, { header: 'Country', key: 'country', width: 16 }, { header: 'City', key: 'city', width: 16 }, { header: 'Status', key: 'status', width: 12 }, { header: 'Source', key: 'source', width: 14 }, { header: 'Created', key: 'created', width: 14 },
    ], rows, { title: 'Customer Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length), 'Filter': `Status: ${statusFilter}, Search: ${search || 'none'}` } });
    toast.success('Customers exported to Excel');
  };

  const stats = { total: customers.length, leads: customers.filter((c) => c.status === 'lead').length, active: customers.filter((c) => c.status === 'active').length, requirements: requirements.length };

  return (
    <div className="space-y-6">
      <PageHeader title="Customers / CRM" description="Manage relationships, vehicle requirements, and customer conversations" actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export</Button><Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />New Customer</Button></div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total customers', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Open leads', value: stats.leads, tone: 'bg-amber-50 text-amber-600' }, { label: 'Active accounts', value: stats.active, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Requirements', value: stats.requirements, tone: 'bg-cyan-50 text-cyan-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, company, email..." /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading customer records...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><CircleUserRound className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No customers found</h3><p className="mt-1 text-sm text-muted-foreground">Create a customer or adjust your search filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((c) => <button key={c.id} onClick={() => loadDetails(c)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{c.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{c.full_name}</p><Badge variant="outline" className={statusStyles[c.status]}>{c.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{c.customer_code}{c.company_name ? ` · ${c.company_name}` : ''}</p></div><div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">{c.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>}{c.country && <span>{c.country}</span>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader><form onSubmit={submitCreate} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div><div className="space-y-2"><Label>Customer type</Label><Select value={form.customer_type} onValueChange={(v: Customer['customer_type']) => setForm({ ...form, customer_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Company name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div><div className="space-y-2"><Label>Source</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="auction">Auction enquiry</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Email {!form.phone.trim() ? '*' : ''}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!form.phone.trim()} /></div><div className="space-y-2"><Label>Phone {!form.email.trim() ? '*' : ''}</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required={!form.email.trim()} /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v: Customer['status']) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.full_name.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create customer'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div><div className="space-y-2"><Label>Customer type</Label><Select value={form.customer_type} onValueChange={(v: Customer['customer_type']) => setForm({ ...form, customer_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Company name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div><div className="space-y-2"><Label>Source</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="auction">Auction enquiry</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Email {!form.phone.trim() ? '*' : ''}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!form.phone.trim()} /></div><div className="space-y-2"><Label>Phone {!form.email.trim() ? '*' : ''}</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required={!form.email.trim()} /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v: Customer['status']) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting || !form.full_name.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete customer?" description={deleteChecking ? 'Checking for related records...' : deleteBlocked || 'This will permanently remove the customer. This action cannot be undone.'} confirmLabel={deleteBlocked ? 'Archive instead' : 'Delete permanently'} destructive={!deleteBlocked} loading={deleteChecking || submitting} onConfirm={deleteBlocked ? archiveCustomer : confirmDelete} />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><>{selected && <><SheetHeader className="pr-8"><div className="flex items-start justify-between gap-3"><div><SheetTitle>{selected.full_name}</SheetTitle><SheetDescription>{selected.customer_code}{selected.company_name ? ` · ${selected.company_name}` : ''}</SheetDescription></div><div className="flex items-center gap-2"><Select value={selected.status} onValueChange={(v: Customer['status']) => updateStatus(v)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={checkDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading profile...</div> : <div className="space-y-6 pt-2"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</p><p className="mt-1 text-sm font-medium">{selected.email || 'No email'}</p><p className="mt-1 text-xs text-muted-foreground">{selected.phone || 'No phone number'}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p><p className="mt-1 text-sm font-medium">{selected.city || 'City not set'}</p><p className="mt-1 text-xs text-muted-foreground">{selected.country || 'Country not set'}</p></div></div>{selected.notes && <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><FileText className="mr-2 inline h-4 w-4" />{selected.notes}</div>}<section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Contacts</h3></div><Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{contacts.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No additional contacts yet.</p> : <div className="space-y-2">{contacts.map((contact) => <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{contact.name}{contact.is_primary && <span className="ml-2 text-[10px] text-primary">PRIMARY</span>}</p><p className="truncate text-xs text-muted-foreground">{contact.role || contact.email || contact.phone || 'No details'}</p></div></div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Vehicle requirements</h3></div><Button variant="outline" size="sm" onClick={() => setRequirementOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{requirements.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No vehicle requirements yet.</p> : <div className="space-y-2">{requirements.map((r) => <div key={r.id} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{[r.make, r.model].filter(Boolean).join(' ') || 'Vehicle preference'}</p><Badge variant="outline">{r.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{r.year_from || 'Any'} - {r.year_to || 'Any'}{r.budget_min || r.budget_max ? ` · ${r.currency} ${r.budget_min || 0} - ${r.budget_max || 'open'}` : ''}</p></div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Communication timeline</h3></div><Button variant="outline" size="sm" onClick={() => setCommunicationOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Log interaction</Button></div>{communications.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No interactions logged yet.</p> : <div className="space-y-3">{communications.map((com) => <div key={com.id} className="relative border-l-2 border-border pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-primary" /><p className="text-sm font-medium">{com.subject}</p></div><p className="mt-1 text-xs text-muted-foreground">{com.communication_type} · {format(new Date(com.created_at), 'MMM d, yyyy h:mm a')}</p>{com.body && <p className="mt-2 text-sm text-muted-foreground">{com.body}</p>}</div>)}</div>}</section></div>}</>}</></SheetContent></Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader><form onSubmit={submitContact} className="space-y-4"><div className="space-y-2"><Label>Name *</Label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div></div><div className="space-y-2"><Label>Role</Label><Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} /></div><DialogFooter><Button type="submit" disabled={submitting || !contactForm.name.trim()}>Save contact</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add vehicle requirement</DialogTitle></DialogHeader><form onSubmit={submitRequirement} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Make</Label><Input value={requirementForm.make} onChange={(e) => setRequirementForm({ ...requirementForm, make: e.target.value })} /></div><div className="space-y-2"><Label>Model</Label><Input value={requirementForm.model} onChange={(e) => setRequirementForm({ ...requirementForm, model: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Year from</Label><Input type="number" value={requirementForm.year_from} onChange={(e) => setRequirementForm({ ...requirementForm, year_from: e.target.value })} /></div><div className="space-y-2"><Label>Year to</Label><Input type="number" value={requirementForm.year_to} onChange={(e) => setRequirementForm({ ...requirementForm, year_to: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Min budget</Label><Input type="number" value={requirementForm.budget_min} onChange={(e) => setRequirementForm({ ...requirementForm, budget_min: e.target.value })} /></div><div className="space-y-2"><Label>Max budget</Label><Input type="number" value={requirementForm.budget_max} onChange={(e) => setRequirementForm({ ...requirementForm, budget_max: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={requirementForm.currency} onChange={(e) => setRequirementForm({ ...requirementForm, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={requirementForm.notes} onChange={(e) => setRequirementForm({ ...requirementForm, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting}>Save requirement</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={communicationOpen} onOpenChange={setCommunicationOpen}><DialogContent><DialogHeader><DialogTitle>Log customer interaction</DialogTitle></DialogHeader><form onSubmit={submitCommunication} className="space-y-4"><div className="space-y-2"><Label>Type</Label><Select value={communicationForm.communication_type} onValueChange={(v: CustomerCommunication['communication_type']) => setCommunicationForm({ ...communicationForm, communication_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="call">Phone call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="visit">Visit</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Subject *</Label><Input value={communicationForm.subject} onChange={(e) => setCommunicationForm({ ...communicationForm, subject: e.target.value })} required /></div><div className="space-y-2"><Label>Details</Label><Textarea value={communicationForm.body} onChange={(e) => setCommunicationForm({ ...communicationForm, body: e.target.value })} rows={4} /></div><DialogFooter><Button type="submit" disabled={submitting || !communicationForm.subject.trim()}>Add to timeline</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
