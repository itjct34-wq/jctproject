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
import type { Customer, CustomerCommunication, CustomerContact, CustomerRequirement } from '@/lib/types';
import { CarFront, Check, ChevronRight, CircleUserRound, FileText, Loader2, Mail, MessageSquare, Plus, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Customer['status'], string> = {
  lead: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
};

const emptyCustomerForm = {
  full_name: '',
  company_name: '',
  customer_type: 'individual' as Customer['customer_type'],
  email: '',
  phone: '',
  whatsapp: '',
  country: '',
  city: '',
  source: 'website',
  status: 'lead' as Customer['status'],
  notes: '',
};

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [requirements, setRequirements] = useState<CustomerRequirement[]>([]);
  const [communications, setCommunications] = useState<CustomerCommunication[]>([]);
  const [openRequirementCount, setOpenRequirementCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [requirementOpen, setRequirementOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [requirementForm, setRequirementForm] = useState({ make: '', model: '', year_from: '', year_to: '', budget_min: '', budget_max: '', currency: 'JPY', notes: '' });
  const [communicationForm, setCommunicationForm] = useState({ communication_type: 'note' as CustomerCommunication['communication_type'], subject: '', body: '' });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const [customersResult, requirementsResult] = await Promise.all([
      supabase.from('customers').select('*').order('updated_at', { ascending: false }),
      supabase.from('customer_requirements').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    if (customersResult.error) {
      toast.error(`Unable to load customers: ${customersResult.error.message}`);
    } else {
      setCustomers((customersResult.data || []) as Customer[]);
    }
    if (!requirementsResult.error) setOpenRequirementCount(requirementsResult.count || 0);
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailLoading(true);
    const [contactsResult, requirementsResult, communicationsResult] = await Promise.all([
      supabase.from('customer_contacts').select('*').eq('customer_id', customer.id).order('is_primary', { ascending: false }),
      supabase.from('customer_requirements').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('customer_communications').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    ]);
    if (contactsResult.error || requirementsResult.error || communicationsResult.error) {
      toast.error('Some customer details could not be loaded');
    }
    setContacts((contactsResult.data || []) as CustomerContact[]);
    setRequirements((requirementsResult.data || []) as CustomerRequirement[]);
    setCommunications((communicationsResult.data || []) as CustomerCommunication[]);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      const matchesSearch = !query || [customer.customer_code, customer.full_name, customer.company_name, customer.email, customer.phone, customer.country]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [customers, search, statusFilter]);

  const submitCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !customerForm.full_name.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('customers').insert({
      ...customerForm,
      full_name: customerForm.full_name.trim(),
      company_name: customerForm.company_name.trim() || null,
      email: customerForm.email.trim() || null,
      phone: customerForm.phone.trim() || null,
      whatsapp: customerForm.whatsapp.trim() || null,
      country: customerForm.country.trim() || null,
      city: customerForm.city.trim() || null,
      notes: customerForm.notes.trim() || null,
      assigned_to: profile.id,
      created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(`Could not create customer: ${error.message}`);
      return;
    }
    toast.success('Customer added to CRM');
    setCustomerForm(emptyCustomerForm);
    setCreateOpen(false);
    await loadCustomers();
    if (data) await loadDetails(data as Customer);
  };

  const updateCustomerStatus = async (status: Customer['status']) => {
    if (!selectedCustomer) return;
    const { error } = await supabase.from('customers').update({ status, updated_at: new Date().toISOString() }).eq('id', selectedCustomer.id);
    if (error) {
      toast.error(`Could not update status: ${error.message}`);
      return;
    }
    const updated = { ...selectedCustomer, status };
    setSelectedCustomer(updated);
    setCustomers((items) => items.map((item) => item.id === updated.id ? updated : item));
    toast.success('Customer status updated');
  };

  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer || !contactForm.name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_contacts').insert({
      customer_id: selectedCustomer.id,
      name: contactForm.name.trim(),
      email: contactForm.email.trim() || null,
      phone: contactForm.phone.trim() || null,
      role: contactForm.role.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Could not add contact: ${error.message}`);
      return;
    }
    setContactForm({ name: '', email: '', phone: '', role: '' });
    setContactOpen(false);
    await loadDetails(selectedCustomer);
    toast.success('Contact added');
  };

  const submitRequirement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !selectedCustomer) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_requirements').insert({
      customer_id: selectedCustomer.id,
      make: requirementForm.make.trim() || null,
      model: requirementForm.model.trim() || null,
      year_from: requirementForm.year_from ? Number(requirementForm.year_from) : null,
      year_to: requirementForm.year_to ? Number(requirementForm.year_to) : null,
      budget_min: requirementForm.budget_min ? Number(requirementForm.budget_min) : null,
      budget_max: requirementForm.budget_max ? Number(requirementForm.budget_max) : null,
      currency: requirementForm.currency,
      notes: requirementForm.notes.trim() || null,
      created_by: profile.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Could not add requirement: ${error.message}`);
      return;
    }
    setRequirementForm({ make: '', model: '', year_from: '', year_to: '', budget_min: '', budget_max: '', currency: 'JPY', notes: '' });
    setRequirementOpen(false);
    await loadDetails(selectedCustomer);
    toast.success('Vehicle requirement added');
  };

  const submitCommunication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !selectedCustomer || !communicationForm.subject.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('customer_communications').insert({
      customer_id: selectedCustomer.id,
      communication_type: communicationForm.communication_type,
      subject: communicationForm.subject.trim(),
      body: communicationForm.body.trim() || null,
      created_by: profile.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Could not add interaction: ${error.message}`);
      return;
    }
    setCommunicationForm({ communication_type: 'note', subject: '', body: '' });
    setCommunicationOpen(false);
    await loadDetails(selectedCustomer);
    toast.success('Interaction added to timeline');
  };

  const stats = {
    total: customers.length,
    leads: customers.filter((customer) => customer.status === 'lead').length,
    active: customers.filter((customer) => customer.status === 'active').length,
    requirements: openRequirementCount,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers / CRM"
        description="Manage relationships, vehicle requirements, and customer conversations"
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New Customer</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total customers', value: stats.total, icon: CircleUserRound, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Open leads', value: stats.leads, icon: Search, tone: 'bg-amber-50 text-amber-600' },
          { label: 'Active accounts', value: stats.active, icon: Check, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Open requirements', value: stats.requirements, icon: CarFront, tone: 'bg-cyan-50 text-cyan-600' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold">{stat.value}</p></div></CardContent></Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, company, email..." className="pl-9" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-44"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60">
        {loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading customer records...</div> : filteredCustomers.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><CircleUserRound className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No customers found</h3><p className="mt-1 text-sm text-muted-foreground">Create a customer or adjust your search filters.</p></div> : <div className="divide-y divide-border/70">{filteredCustomers.map((customer) => <button key={customer.id} onClick={() => loadDetails(customer)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{customer.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{customer.full_name}</p><Badge variant="outline" className={statusStyles[customer.status]}>{customer.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{customer.customer_code} {customer.company_name ? `· ${customer.company_name}` : ''}</p></div><div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">{customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}{customer.country && <span>{customer.country}</span>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader><form onSubmit={submitCustomer} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Full name *</Label><Input value={customerForm.full_name} onChange={(event) => setCustomerForm({ ...customerForm, full_name: event.target.value })} required placeholder="Customer name" /></div><div className="space-y-2"><Label>Customer type</Label><Select value={customerForm.customer_type} onValueChange={(value: Customer['customer_type']) => setCustomerForm({ ...customerForm, customer_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Company name</Label><Input value={customerForm.company_name} onChange={(event) => setCustomerForm({ ...customerForm, company_name: event.target.value })} placeholder="Company or organization" /></div><div className="space-y-2"><Label>Source</Label><Select value={customerForm.source} onValueChange={(value) => setCustomerForm({ ...customerForm, source: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="auction">Auction enquiry</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Email</Label><Input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} /></div><div className="space-y-2"><Label>WhatsApp</Label><Input value={customerForm.whatsapp} onChange={(event) => setCustomerForm({ ...customerForm, whatsapp: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Country</Label><Input value={customerForm.country} onChange={(event) => setCustomerForm({ ...customerForm, country: event.target.value })} /></div><div className="space-y-2"><Label>City</Label><Input value={customerForm.city} onChange={(event) => setCustomerForm({ ...customerForm, city: event.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} placeholder="Context for the sales team" rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting || !customerForm.full_name.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create customer'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Sheet open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><>{selectedCustomer && <><SheetHeader className="pr-8"><div className="flex items-start justify-between gap-3"><div><SheetTitle>{selectedCustomer.full_name}</SheetTitle><SheetDescription>{selectedCustomer.customer_code}{selectedCustomer.company_name ? ` · ${selectedCustomer.company_name}` : ''}</SheetDescription></div><Select value={selectedCustomer.status} onValueChange={(value: Customer['status']) => updateCustomerStatus(value)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead">Lead</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></SheetHeader>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading profile...</div> : <div className="space-y-6 pt-6"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</p><p className="mt-1 text-sm font-medium">{selectedCustomer.email || 'No email'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedCustomer.phone || 'No phone number'}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p><p className="mt-1 text-sm font-medium">{selectedCustomer.city || 'City not set'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedCustomer.country || 'Country not set'}</p></div></div>{selectedCustomer.notes && <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><FileText className="mr-2 inline h-4 w-4" />{selectedCustomer.notes}</div>}<section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Contacts</h3><p className="text-xs text-muted-foreground">People connected to this account</p></div><Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{contacts.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No additional contacts yet.</p> : <div className="space-y-2">{contacts.map((contact) => <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{contact.name}{contact.is_primary && <span className="ml-2 text-[10px] text-primary">PRIMARY</span>}</p><p className="truncate text-xs text-muted-foreground">{contact.role || contact.email || contact.phone || 'No details'}</p></div></div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Vehicle requirements</h3><p className="text-xs text-muted-foreground">What this customer is looking for</p></div><Button variant="outline" size="sm" onClick={() => setRequirementOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{requirements.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No vehicle requirements yet.</p> : <div className="space-y-2">{requirements.map((requirement) => <div key={requirement.id} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{[requirement.make, requirement.model].filter(Boolean).join(' ') || 'Vehicle preference'}</p><Badge variant="outline">{requirement.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{requirement.year_from || 'Any'} - {requirement.year_to || 'Any'} · {requirement.budget_min || requirement.budget_max ? `${requirement.currency} ${requirement.budget_min || 0} - ${requirement.budget_max || 'open'}` : 'Budget open'}</p>{requirement.notes && <p className="mt-2 text-xs text-muted-foreground">{requirement.notes}</p>}</div>)}</div>}</section><section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Communication timeline</h3><p className="text-xs text-muted-foreground">Keep every interaction in one place</p></div><Button variant="outline" size="sm" onClick={() => setCommunicationOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Log interaction</Button></div>{communications.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No interactions logged yet.</p> : <div className="space-y-3">{communications.map((communication) => <div key={communication.id} className="relative border-l-2 border-border pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-primary" /><p className="text-sm font-medium">{communication.subject}</p></div><p className="mt-1 text-xs text-muted-foreground">{communication.communication_type} · {format(new Date(communication.created_at), 'MMM d, yyyy h:mm a')}</p>{communication.body && <p className="mt-2 text-sm text-muted-foreground">{communication.body}</p>}</div>)}</div>}</section></div>}</>}</></SheetContent></Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader><form onSubmit={submitContact} className="space-y-4"><div className="space-y-2"><Label>Name *</Label><Input value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} /></div></div><div className="space-y-2"><Label>Role</Label><Input value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} placeholder="Purchasing manager" /></div><DialogFooter><Button type="submit" disabled={submitting || !contactForm.name.trim()}>Save contact</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add vehicle requirement</DialogTitle></DialogHeader><form onSubmit={submitRequirement} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Make</Label><Input value={requirementForm.make} onChange={(event) => setRequirementForm({ ...requirementForm, make: event.target.value })} placeholder="Toyota" /></div><div className="space-y-2"><Label>Model</Label><Input value={requirementForm.model} onChange={(event) => setRequirementForm({ ...requirementForm, model: event.target.value })} placeholder="Prius" /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Year from</Label><Input type="number" value={requirementForm.year_from} onChange={(event) => setRequirementForm({ ...requirementForm, year_from: event.target.value })} /></div><div className="space-y-2"><Label>Year to</Label><Input type="number" value={requirementForm.year_to} onChange={(event) => setRequirementForm({ ...requirementForm, year_to: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Min budget</Label><Input type="number" value={requirementForm.budget_min} onChange={(event) => setRequirementForm({ ...requirementForm, budget_min: event.target.value })} /></div><div className="space-y-2"><Label>Max budget</Label><Input type="number" value={requirementForm.budget_max} onChange={(event) => setRequirementForm({ ...requirementForm, budget_max: event.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={requirementForm.currency} onChange={(event) => setRequirementForm({ ...requirementForm, currency: event.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={requirementForm.notes} onChange={(event) => setRequirementForm({ ...requirementForm, notes: event.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting}>Save requirement</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={communicationOpen} onOpenChange={setCommunicationOpen}><DialogContent><DialogHeader><DialogTitle>Log customer interaction</DialogTitle></DialogHeader><form onSubmit={submitCommunication} className="space-y-4"><div className="space-y-2"><Label>Type</Label><Select value={communicationForm.communication_type} onValueChange={(value: CustomerCommunication['communication_type']) => setCommunicationForm({ ...communicationForm, communication_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="call">Phone call</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="visit">Visit</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Subject *</Label><Input value={communicationForm.subject} onChange={(event) => setCommunicationForm({ ...communicationForm, subject: event.target.value })} required placeholder="Follow-up on vehicle request" /></div><div className="space-y-2"><Label>Details</Label><Textarea value={communicationForm.body} onChange={(event) => setCommunicationForm({ ...communicationForm, body: event.target.value })} rows={4} /></div><DialogFooter><Button type="submit" disabled={submitting || !communicationForm.subject.trim()}>Add to timeline</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
