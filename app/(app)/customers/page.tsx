'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
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
import { ErpEmptyState } from '@/components/shared/erp-empty-state';
import { CustomersBulkImportButton } from '@/components/customers/customers-bulk-import-button';
import type { Customer, CustomerCommunication, CustomerContact, CustomerRequirement } from '@/lib/types';
import { customerContactErrorMessage, isCustomerConsigneeComplete } from '@/lib/utils/customer-contact';
import { ChevronRight, CircleUserRound, Download, FileText, Loader2, Mail, MessageSquare, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Customer['status'], string> = {
  lead: 'border-warning/45 bg-warning/15 text-warning',
  active: 'border-success/40 bg-success/15 text-success',
  inactive: 'border-border bg-muted text-foreground/70',
  blocked: 'border-destructive/40 bg-destructive/15 text-destructive',
};
const emptyForm = { full_name: '', company_name: '', customer_type: 'individual' as Customer['customer_type'], email: '', phone: '', whatsapp: '', address_line1: '', country: '', city: '', port_of_discharge: '', source: 'website', status: 'lead' as Customer['status'], notes: '' };
type Staff = { id: string; full_name: string | null; email: string | null };
const ASSIGNABLE_ROLES = new Set(['sales_agent', 'freelancer', 'operations', 'manager', 'admin', 'super_admin']);

export default function CustomersPage() {
  const { profile } = useAuth();
  const { can, isSellingFocused, isElevatedStaff } = usePermissions();
  const canEditCustomer = can('customers', 'edit');
  const canDeleteCustomer = can('customers', 'delete');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
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
  const archiveTargetRef = useRef<Customer | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [requirementForm, setRequirementForm] = useState({ make: '', model: '', year_from: '', year_to: '', budget_min: '', budget_max: '', currency: 'JPY', notes: '' });
  const [communicationForm, setCommunicationForm] = useState({ communication_type: 'note' as CustomerCommunication['communication_type'], subject: '', body: '' });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from('customers').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name, email, is_active').eq('is_active', true).order('full_name').limit(500),
      supabase.from('user_roles').select('user_id, is_active, roles(name)').eq('is_active', true),
    ]);
    if (error) toast.error(`Unable to load customers: ${error.message}`);
    else setCustomers((data || []) as Customer[]);
    const profilesList = (profiles || []) as Staff[];
    const allowedIds = new Set<string>();
    const roleUserIds = new Set<string>();
    (roleRows || []).forEach((row: { user_id: string; roles?: { name: string } | { name: string }[] | null }) => {
      roleUserIds.add(row.user_id);
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      if (role?.name && ASSIGNABLE_ROLES.has(role.name)) allowedIds.add(row.user_id);
    });
    // Selling roles can only read their own user_roles row; fall back to all active profiles for hand-off.
    const filtered = roleUserIds.size > 1 && allowedIds.size > 0
      ? profilesList.filter((p) => allowedIds.has(p.id))
      : profilesList;
    const assigneeIds = Array.from(new Set((data || []).map((c: { assigned_to?: string | null }) => c.assigned_to).filter(Boolean) as string[]));
    const missing = assigneeIds.filter((id) => !filtered.some((p) => p.id === id));
    if (missing.length) {
      const { data: extra } = await supabase.from('profiles').select('id, full_name, email').in('id', missing);
      setStaff([...filtered, ...((extra || []) as Staff[])]);
    } else {
      setStaff(filtered);
    }
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

  const staffName = useCallback((userId: string | null) => {
    if (!userId) return 'Unassigned';
    const person = staff.find((s) => s.id === userId);
    if (person) return person.full_name || person.email || 'Staff';
    if (profile?.id === userId) return profile.full_name || profile.email || 'You';
    return 'Staff';
  }, [staff, profile]);

  const canReassign = useCallback((customer: Customer) => {
    if (!profile) return false;
    if (isElevatedStaff) return true;
    return customer.assigned_to === profile.id || (!customer.assigned_to && customer.created_by === profile.id);
  }, [profile, isElevatedStaff]);

  const reassignCustomer = async (customer: Customer, userId: string) => {
    if (!profile || userId === (customer.assigned_to || '')) return;
    const { error } = await supabase.from('customers').update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq('id', customer.id);
    if (error) { toast.error(`Could not reassign: ${error.message}`); return; }
    const stillVisible = isElevatedStaff || userId === profile.id;
    if (!stillVisible) {
      setSelected(null);
      setCustomers((items) => items.filter((i) => i.id !== customer.id));
      toast.success('Customer handed off');
      return;
    }
    const updated = { ...customer, assigned_to: userId };
    setSelected((cur) => (cur?.id === customer.id ? updated : cur));
    setCustomers((items) => items.map((i) => (i.id === customer.id ? updated : i)));
    toast.success(`Assigned to ${staffName(userId)}`);
  };

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true); };
  const openEdit = () => {
    if (!selected) return;
    setForm({
      full_name: selected.full_name,
      company_name: selected.company_name || '',
      customer_type: selected.customer_type,
      email: selected.email || '',
      phone: selected.phone || '',
      whatsapp: selected.whatsapp || '',
      address_line1: selected.address_line1 || '',
      country: selected.country || '',
      city: selected.city || '',
      port_of_discharge: selected.port_of_discharge || '',
      source: selected.source || 'website',
      status: selected.status,
      notes: selected.notes || '',
    });
    setEditOpen(true);
  };

  const consigneeReady = !isCustomerConsigneeComplete({
    full_name: form.full_name,
    email: form.email,
    phone: form.phone,
    address_line1: form.address_line1,
  });

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const missing = isCustomerConsigneeComplete({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      address_line1: form.address_line1,
    });
    if (missing) { toast.error(missing); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from('customers').insert({
      ...form,
      full_name: form.full_name.trim(),
      company_name: form.company_name.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      address_line1: form.address_line1.trim(),
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      port_of_discharge: form.port_of_discharge.trim() || null,
      notes: form.notes.trim() || null,
      assigned_to: profile.id,
      created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(customerContactErrorMessage(error)); return; }
    toast.success('Customer added to CRM'); setForm(emptyForm); setCreateOpen(false); await loadCustomers();
    if (data) await loadDetails(data as Customer);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const missing = isCustomerConsigneeComplete({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      address_line1: form.address_line1,
    });
    if (missing) { toast.error(missing); return; }
    setSubmitting(true);
    const { error } = await supabase.from('customers').update({
      full_name: form.full_name.trim(),
      company_name: form.company_name.trim() || null,
      customer_type: form.customer_type,
      email: form.email.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      address_line1: form.address_line1.trim(),
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      port_of_discharge: form.port_of_discharge.trim() || null,
      source: form.source,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(customerContactErrorMessage(error)); return; }
    const updated = {
      ...selected,
      ...form,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address_line1: form.address_line1.trim(),
    };
    setSelected(updated); setCustomers((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Customer updated'); setEditOpen(false);
  };

  const checkDelete = async () => {
    if (!selected) return;
    if (!canEditCustomer && !canDeleteCustomer) {
      toast.error('You do not have permission to remove or archive customers.');
      return;
    }
    archiveTargetRef.current = selected;
    setDeleteOpen(true);
    setDeleteChecking(true);
    setDeleteBlocked(null);
    const [salesRes, invoicesRes, paymentsRes, quotationsRes, vehiclesRes] = await Promise.all([
      supabase.from('sales').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('customer_id', selected.id),
    ]);
    const counts = {
      sales: salesRes.count || 0,
      invoices: invoicesRes.count || 0,
      payments: paymentsRes.count || 0,
      quotations: quotationsRes.count || 0,
      vehicles: vehiclesRes.count || 0,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const parts: string[] = [];
      if (counts.sales) parts.push(`${counts.sales} sale(s)`);
      if (counts.invoices) parts.push(`${counts.invoices} invoice(s)`);
      if (counts.payments) parts.push(`${counts.payments} payment(s)`);
      if (counts.quotations) parts.push(`${counts.quotations} quotation(s)`);
      if (counts.vehicles) parts.push(`${counts.vehicles} reserved/linked vehicle(s)`);
      setDeleteBlocked(`This customer has ${parts.join(', ')}. Archive them instead to preserve history.`);
    }
    setDeleteChecking(false);
  };

  const confirmDelete = async () => {
    const customer = archiveTargetRef.current || selected;
    if (!customer) {
      toast.error('No customer selected to delete.');
      return;
    }
    if (!canDeleteCustomer) {
      toast.error('Only admins and managers can permanently delete customers. Use Archive instead.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id)
      .select('id')
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    if (!data) {
      toast.error('Could not delete: you may not have permission, or the customer was already removed.');
      return;
    }
    toast.success('Customer deleted');
    setDeleteOpen(false);
    archiveTargetRef.current = null;
    setSelected(null);
    await loadCustomers();
  };

  const archiveCustomer = async () => {
    const customer = archiveTargetRef.current || selected;
    if (!customer) {
      toast.error('No customer selected to archive.');
      return;
    }
    if (!canEditCustomer && !isElevatedStaff) {
      toast.error('You do not have permission to archive this customer.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from('customers')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', customer.id)
      .select('id, status')
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(customerContactErrorMessage(error));
      return;
    }
    if (!data) {
      toast.error('Could not archive: you may not have permission to update this customer.');
      return;
    }
    const updated = { ...customer, status: 'inactive' as const };
    setSelected((cur) => (cur?.id === updated.id ? updated : cur));
    setCustomers((items) => items.map((i) => (i.id === updated.id ? { ...i, status: 'inactive' } : i)));
    toast.success('Customer archived (status set to inactive)');
    setDeleteOpen(false);
    archiveTargetRef.current = null;
  };

  const updateStatus = async (status: Customer['status']) => {
    if (!selected) return;
    if (!canEditCustomer && !isElevatedStaff) {
      toast.error('You do not have permission to change customer status.');
      return;
    }
    const { data, error } = await supabase
      .from('customers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
      .select('id, status')
      .maybeSingle();
    if (error) {
      toast.error(customerContactErrorMessage(error));
      return;
    }
    if (!data) {
      toast.error('Could not update status: you may not have permission.');
      return;
    }
    const updated = { ...selected, status };
    setSelected(updated);
    setCustomers((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success(status === 'inactive' ? 'Customer archived' : 'Status updated');
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
    const rows = filtered.map((c) => ({ code: c.customer_code, name: c.full_name, company: c.company_name || '', type: c.customer_type, email: c.email || '', phone: c.phone || '', country: c.country || '', city: c.city || '', status: c.status, source: c.source || '', assigned: staffName(c.assigned_to), created: format(new Date(c.created_at), 'yyyy-MM-dd') }));
    await exportToExcel('customers-export', 'Customers', [
      { header: 'Customer Code', key: 'code', width: 16 }, { header: 'Name', key: 'name', width: 24 }, { header: 'Company', key: 'company', width: 24 }, { header: 'Type', key: 'type', width: 12 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Phone', key: 'phone', width: 18 }, { header: 'Country', key: 'country', width: 16 }, { header: 'City', key: 'city', width: 16 }, { header: 'Status', key: 'status', width: 12 }, { header: 'Source', key: 'source', width: 14 }, { header: 'Assigned to', key: 'assigned', width: 22 }, { header: 'Created', key: 'created', width: 14 },
    ], rows, { title: 'Customer Export', details: { 'Export Date': new Date().toISOString(), 'Total Records': String(rows.length), 'Filter': `Status: ${statusFilter}, Search: ${search || 'none'}` } });
    toast.success('Customers exported to Excel');
  };

  const stats = { total: customers.length, leads: customers.filter((c) => c.status === 'lead').length, active: customers.filter((c) => c.status === 'active').length, requirements: requirements.length };
  const forceArchive = Boolean(deleteBlocked) || !canDeleteCustomer;
  const deleteDescription = deleteChecking
    ? 'Checking for related records...'
    : deleteBlocked
      || (canDeleteCustomer
        ? 'This will permanently remove the customer. This action cannot be undone.'
        : 'Permanent delete requires an admin or manager. Archive sets status to inactive and keeps history.');

  return (
    <div className="space-y-6">
      <PageHeader title="Customers / CRM" description="Manage relationships, vehicle requirements, and customer conversations" actions={<div className="flex gap-2"><CustomersBulkImportButton onDone={loadCustomers} /><Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1.5 h-4 w-4" />Export</Button><Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />New Customer</Button></div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total customers', value: stats.total }, { label: 'Open leads', value: stats.leads }, { label: 'Active accounts', value: stats.active }, { label: 'Requirements', value: stats.requirements },
      ].map((s) => <Card key={s.label} className="erp-stat-card rounded-md shadow-sm"><CardContent className="p-3.5 sm:p-4"><p className="erp-stat-label">{s.label}</p><p className="erp-stat-value">{s.value}</p></CardContent></Card>)}</div>
      <div className="erp-filter-panel">
        <div className="erp-filter-bar">
          <div className="erp-filter-search">
            <Search aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, company, email..." />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="erp-filter-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="erp-list-panel">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading customer records...
          </div>
        ) : filtered.length === 0 ? (
          <ErpEmptyState icon={CircleUserRound} title="No customers found" description={isSellingFocused ? 'You only see customers assigned to you.' : 'Create a customer or adjust your search filters.'} />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => loadDetails(c)} className="erp-list-row">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {c.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{c.full_name}</p>
                    <Badge variant="outline" className={`rounded-full text-xs capitalize ${statusStyles[c.status]}`}>{c.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.customer_code}{c.company_name ? ` · ${c.company_name}` : ''} · Assigned to {staffName(c.assigned_to)}
                  </p>
                </div>
                <div className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
                  {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.country && <span>{c.country}</span>}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader><form onSubmit={submitCreate} className="space-y-2.5">
        <p className="text-xs text-muted-foreground">Consignee details print on invoices. Phone and email must be unique.</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3"><div className="space-y-0.5"><Label>Consignee Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div><div className="space-y-0.5"><Label>Customer type</Label><Select value={form.customer_type} onValueChange={(v: Customer['customer_type']) => setForm({ ...form, customer_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div><div className="space-y-0.5"><Label>Source</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="auction">Auction enquiry</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-0.5"><Label>Company name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div><div className="space-y-0.5"><Label>Contact *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+923353522447" /></div><div className="space-y-0.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div><div className="space-y-0.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div><div className="space-y-0.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-0.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-0.5"><Label>Port of discharge</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} placeholder="e.g. Mombasa, Karachi" /></div><div className="space-y-0.5 sm:col-span-2 lg:col-span-2"><Label>Address *</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required placeholder="Shipping address" /></div><div className="space-y-0.5"><Label>Status</Label><Select value={form.status} onValueChange={(v: Customer['status']) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div><div className="space-y-0.5 sm:col-span-2 lg:col-span-3"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div></div>
        <p className="text-xs text-muted-foreground">Assigned to you; reassign later if you hand off the deal.</p>
        <DialogFooter><Button type="submit" disabled={submitting || !consigneeReady}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create customer'}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-2.5">
        <p className="text-xs text-muted-foreground">Consignee details print on invoices. Phone and email must be unique.</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3"><div className="space-y-0.5"><Label>Consignee Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div><div className="space-y-0.5"><Label>Customer type</Label><Select value={form.customer_type} onValueChange={(v: Customer['customer_type']) => setForm({ ...form, customer_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div><div className="space-y-0.5"><Label>Source</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="auction">Auction enquiry</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-0.5"><Label>Company name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div><div className="space-y-0.5"><Label>Contact *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div><div className="space-y-0.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div><div className="space-y-0.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div><div className="space-y-0.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-0.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-0.5"><Label>Port of discharge</Label><Input value={form.port_of_discharge} onChange={(e) => setForm({ ...form, port_of_discharge: e.target.value })} placeholder="e.g. Mombasa, Karachi" /></div><div className="space-y-0.5 sm:col-span-2 lg:col-span-2"><Label>Address *</Label><Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required /></div><div className="space-y-0.5"><Label>Status</Label><Select value={form.status} onValueChange={(v: Customer['status']) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div><div className="space-y-0.5 sm:col-span-2 lg:col-span-3"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting || !consigneeReady}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) archiveTargetRef.current = null;
        }}
        title={forceArchive ? 'Archive customer?' : 'Delete customer?'}
        description={deleteDescription}
        confirmLabel={forceArchive ? (deleteBlocked ? 'Archive instead' : 'Archive customer') : 'Delete permanently'}
        destructive={!forceArchive}
        loading={deleteChecking || submitting}
        onConfirm={forceArchive ? archiveCustomer : confirmDelete}
      />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><>{selected && <><SheetHeader className="pr-8"><div className="flex items-start justify-between gap-3"><div><SheetTitle>{selected.full_name}</SheetTitle><SheetDescription>{selected.customer_code}{selected.company_name ? ` · ${selected.company_name}` : ''}</SheetDescription></div><div className="flex items-center gap-2"><Select value={selected.status} onValueChange={(v: Customer['status']) => updateStatus(v)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div></SheetHeader><div className="flex gap-2 pb-2">{canEditCustomer && <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}{(canEditCustomer || canDeleteCustomer) && <Button size="sm" variant="outline" onClick={() => void checkDelete()}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{canDeleteCustomer ? 'Delete' : 'Archive'}</Button>}</div>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading profile...</div> : <div className="space-y-6 pt-2"><div className="rounded-lg border border-border/70 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned to</p>{canReassign(selected) ? <Select value={selected.assigned_to ?? undefined} onValueChange={(v) => void reassignCustomer(selected, v)}><SelectTrigger className="mt-2"><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>)}{selected.assigned_to && !staff.some((p) => p.id === selected.assigned_to) && <SelectItem value={selected.assigned_to}>{staffName(selected.assigned_to)}</SelectItem>}</SelectContent></Select> : <p className="mt-1 text-sm font-medium">{staffName(selected.assigned_to)}</p>}<p className="mt-1 text-xs text-muted-foreground">Company and ongoing quotes, invoices, and sales follow this owner.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Consignee contact</p><p className="mt-1 text-sm font-medium">{selected.email || 'No email'}</p><p className="mt-1 text-xs text-muted-foreground">{selected.phone || 'No phone number'}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Shipping address</p><p className="mt-1 text-sm font-medium">{selected.address_line1 || 'Address not set'}</p><p className="mt-1 text-xs text-muted-foreground">{[selected.city, selected.country].filter(Boolean).join(', ') || 'City / country not set'}</p>{selected.port_of_discharge ? <p className="mt-1 text-xs text-muted-foreground">POD: {selected.port_of_discharge}</p> : null}</div></div>{selected.notes && <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><FileText className="mr-2 inline h-4 w-4" />{selected.notes}</div>}<section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Contacts</h3></div><Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{contacts.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No additional contacts yet.</p> : <div className="space-y-2">{contacts.map((contact) => <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{contact.name}{contact.is_primary && <span className="ml-2 text-xs text-primary">PRIMARY</span>}</p><p className="truncate text-xs text-muted-foreground">{contact.role || contact.email || contact.phone || 'No details'}</p></div></div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Vehicle requirements</h3></div><Button variant="outline" size="sm" onClick={() => setRequirementOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{requirements.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No vehicle requirements yet.</p> : <div className="space-y-2">{requirements.map((r) => <div key={r.id} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{[r.make, r.model].filter(Boolean).join(' ') || 'Vehicle preference'}</p><Badge variant="outline">{r.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{r.year_from || 'Any'} - {r.year_to || 'Any'}{r.budget_min || r.budget_max ? ` · ${r.currency} ${r.budget_min || 0} - ${r.budget_max || 'open'}` : ''}</p></div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Communication timeline</h3></div><Button variant="outline" size="sm" onClick={() => setCommunicationOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Log interaction</Button></div>{communications.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No interactions logged yet.</p> : <div className="space-y-3">{communications.map((com) => <div key={com.id} className="relative border-l-2 border-border pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-primary" /><p className="text-sm font-medium">{com.subject}</p></div><p className="mt-1 text-xs text-muted-foreground">{com.communication_type} · {format(new Date(com.created_at), 'MMM d, yyyy h:mm a')}</p>{com.body && <p className="mt-2 text-sm text-muted-foreground">{com.body}</p>}</div>)}</div>}</section></div>}</>}</></SheetContent></Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader><form onSubmit={submitContact} className="space-y-3"><div className="space-y-1"><Label>Name *</Label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required /></div><div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div><div className="space-y-1"><Label>Phone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div></div><div className="space-y-1"><Label>Role</Label><Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} /></div><DialogFooter><Button type="submit" disabled={submitting || !contactForm.name.trim()}>Save contact</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Add vehicle requirement</DialogTitle></DialogHeader><form onSubmit={submitRequirement} className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label>Make</Label><Input value={requirementForm.make} onChange={(e) => setRequirementForm({ ...requirementForm, make: e.target.value })} /></div><div className="space-y-1"><Label>Model</Label><Input value={requirementForm.model} onChange={(e) => setRequirementForm({ ...requirementForm, model: e.target.value })} /></div></div><div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label>Year from</Label><Input type="number" value={requirementForm.year_from} onChange={(e) => setRequirementForm({ ...requirementForm, year_from: e.target.value })} /></div><div className="space-y-1"><Label>Year to</Label><Input type="number" value={requirementForm.year_to} onChange={(e) => setRequirementForm({ ...requirementForm, year_to: e.target.value })} /></div></div><div className="grid gap-2 sm:grid-cols-3"><div className="space-y-1"><Label>Min budget</Label><Input type="number" value={requirementForm.budget_min} onChange={(e) => setRequirementForm({ ...requirementForm, budget_min: e.target.value })} /></div><div className="space-y-1"><Label>Max budget</Label><Input type="number" value={requirementForm.budget_max} onChange={(e) => setRequirementForm({ ...requirementForm, budget_max: e.target.value })} /></div><div className="space-y-1"><Label>Currency</Label><Input value={requirementForm.currency} onChange={(e) => setRequirementForm({ ...requirementForm, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-1"><Label>Notes</Label><Textarea value={requirementForm.notes} onChange={(e) => setRequirementForm({ ...requirementForm, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting}>Save requirement</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={communicationOpen} onOpenChange={setCommunicationOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Log customer interaction</DialogTitle></DialogHeader><form onSubmit={submitCommunication} className="space-y-3"><div className="space-y-1"><Label>Type</Label><Select value={communicationForm.communication_type} onValueChange={(v: CustomerCommunication['communication_type']) => setCommunicationForm({ ...communicationForm, communication_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="call">Phone call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="visit">Visit</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Subject *</Label><Input value={communicationForm.subject} onChange={(e) => setCommunicationForm({ ...communicationForm, subject: e.target.value })} required /></div><div className="space-y-1"><Label>Details</Label><Textarea value={communicationForm.body} onChange={(e) => setCommunicationForm({ ...communicationForm, body: e.target.value })} rows={4} /></div><DialogFooter><Button type="submit" disabled={submitting || !communicationForm.subject.trim()}>Add to timeline</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
