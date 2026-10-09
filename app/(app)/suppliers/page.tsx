'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Supplier, SupplierContact } from '@/lib/types';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Building2, CheckCircle2, ChevronRight, Gavel, Loader2, Mail, MapPin, Pencil, Phone, Plus, Search, Store, Trash2, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<Supplier['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
};

const typeLabels: Record<Supplier['supplier_type'], string> = {
  auction_house: 'Auction House',
  dealer: 'Dealer',
  wholesaler: 'Wholesaler',
  individual: 'Individual',
};

const typeIcons: Record<Supplier['supplier_type'], typeof Building2> = {
  auction_house: Gavel,
  dealer: Store,
  wholesaler: Building2,
  individual: UserRound,
};

const emptyForm = {
  name: '', supplier_type: 'dealer' as Supplier['supplier_type'], category: '', country: 'Japan', city: '', address_line1: '', address_line2: '', email: '', phone: '', website: '', contact_person: '', payment_terms: '', default_currency: 'JPY', status: 'active' as Supplier['status'], notes: '',
};

export default function SuppliersPage() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '' });

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('suppliers').select('*').order('updated_at', { ascending: false });
    if (error) toast.error(`Unable to load suppliers: ${error.message}`);
    else setSuppliers((data || []) as Supplier[]);
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDetailLoading(true);
    const { data, error } = await supabase.from('supplier_contacts').select('*').eq('supplier_id', supplier.id).order('is_primary', { ascending: false });
    if (error) toast.error(`Unable to load supplier contacts: ${error.message}`);
    setContacts((data || []) as SupplierContact[]);
    setDetailLoading(false);
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesType = typeFilter === 'all' || supplier.supplier_type === typeFilter;
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
      const matchesSearch = !query || [supplier.supplier_code, supplier.name, supplier.country, supplier.email, supplier.contact_person, supplier.category]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [suppliers, search, typeFilter, statusFilter]);

  const submitSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !form.name.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('suppliers').insert({
      name: form.name.trim(), supplier_type: form.supplier_type, category: form.category.trim() || null,
      country: form.country.trim() || null, city: form.city.trim() || null, address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null,
      website: form.website.trim() || null, contact_person: form.contact_person.trim() || null, payment_terms: form.payment_terms.trim() || null,
      default_currency: form.default_currency, status: form.status, notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(`Could not create supplier: ${error.message}`);
      return;
    }
    toast.success('Supplier added');
    setForm(emptyForm);
    setCreateOpen(false);
    await loadSuppliers();
    if (data) await loadDetails(data as Supplier);
  };

  const openEdit = () => { if (!selectedSupplier) return; setForm({ name: selectedSupplier.name, supplier_type: selectedSupplier.supplier_type, category: selectedSupplier.category || '', country: selectedSupplier.country || '', city: selectedSupplier.city || '', address_line1: selectedSupplier.address_line1 || '', address_line2: selectedSupplier.address_line2 || '', email: selectedSupplier.email || '', phone: selectedSupplier.phone || '', website: selectedSupplier.website || '', contact_person: selectedSupplier.contact_person || '', payment_terms: selectedSupplier.payment_terms || '', default_currency: selectedSupplier.default_currency, status: selectedSupplier.status, notes: selectedSupplier.notes || '' }); setEditOpen(true); };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier || !form.name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('suppliers').update({ name: form.name.trim(), supplier_type: form.supplier_type, category: form.category.trim() || null, country: form.country.trim() || null, city: form.city.trim() || null, address_line1: form.address_line1.trim() || null, address_line2: form.address_line2.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, website: form.website.trim() || null, contact_person: form.contact_person.trim() || null, payment_terms: form.payment_terms.trim() || null, default_currency: form.default_currency, status: form.status, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selectedSupplier.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selectedSupplier, name: form.name.trim(), supplier_type: form.supplier_type, status: form.status, contact_person: form.contact_person.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, country: form.country.trim() || null, city: form.city.trim() || null };
    setSelectedSupplier(updated); setSuppliers((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Supplier updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selectedSupplier) return;
    setSubmitting(true);
    const { error } = await supabase.from('suppliers').delete().eq('id', selectedSupplier.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Supplier deleted'); setDeleteOpen(false); setSelectedSupplier(null); loadSuppliers();
  };

  const updateSupplierStatus = async (status: Supplier['status']) => {
    if (!selectedSupplier) return;
    const { error } = await supabase.from('suppliers').update({ status, updated_at: new Date().toISOString() }).eq('id', selectedSupplier.id);
    if (error) {
      toast.error(`Could not update status: ${error.message}`);
      return;
    }
    const updated = { ...selectedSupplier, status };
    setSelectedSupplier(updated);
    setSuppliers((items) => items.map((item) => item.id === updated.id ? updated : item));
    toast.success('Supplier status updated');
  };

  const submitContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier || !contactForm.name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('supplier_contacts').insert({
      supplier_id: selectedSupplier.id, name: contactForm.name.trim(), email: contactForm.email.trim() || null,
      phone: contactForm.phone.trim() || null, role: contactForm.role.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Could not add contact: ${error.message}`);
      return;
    }
    setContactForm({ name: '', email: '', phone: '', role: '' });
    setContactOpen(false);
    await loadDetails(selectedSupplier);
    toast.success('Contact added');
  };

  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.status === 'active').length,
    auctionHouses: suppliers.filter((s) => s.supplier_type === 'auction_house').length,
    countries: new Set(suppliers.map((s) => s.country).filter(Boolean)).size,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers & Auction Houses" description="Manage supplier relationships, payment terms, and contacts" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add supplier</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total suppliers', value: stats.total, icon: Building2, tone: 'bg-blue-50 text-blue-600' },
        { label: 'Active', value: stats.active, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Auction houses', value: stats.auctionHouses, icon: Gavel, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Countries', value: stats.countries, icon: MapPin, tone: 'bg-cyan-50 text-cyan-600' },
      ].map((stat) => <Card key={stat.label} className="border-border/60"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon className="h-4 w-4" /></div><div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold">{stat.value}</p></div></CardContent></Card>)}</div>

      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, country, contact..." /></div><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full md:w-44"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="auction_house">Auction House</SelectItem><SelectItem value="dealer">Dealer</SelectItem><SelectItem value="wholesaler">Wholesaler</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-40"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></CardContent></Card>

      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading suppliers...</div> : filteredSuppliers.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No suppliers found</h3><p className="mt-1 text-sm text-muted-foreground">Add a supplier or adjust your search filters.</p></div> : <div className="divide-y divide-border/70">{filteredSuppliers.map((supplier) => { const TypeIcon = typeIcons[supplier.supplier_type]; return <button key={supplier.id} onClick={() => loadDetails(supplier)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><TypeIcon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{supplier.name}</p><Badge variant="outline" className={statusStyles[supplier.status]}>{supplier.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{supplier.supplier_code} · {typeLabels[supplier.supplier_type]}{supplier.country ? ` · ${supplier.country}` : ''}</p></div><div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">{supplier.contact_person && <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{supplier.contact_person}</span>}{supplier.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{supplier.email}</span>}</div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>; })}</div>}</Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader><form onSubmit={submitSupplier} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Company or supplier name" /></div><div className="space-y-2"><Label>Type</Label><Select value={form.supplier_type} onValueChange={(value: Supplier['supplier_type']) => setForm({ ...form, supplier_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auction_house">Auction House</SelectItem><SelectItem value="dealer">Dealer</SelectItem><SelectItem value="wholesaler">Wholesaler</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Sedans, SUVs, trucks..." /></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value: Supplier['status']) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.co.jp" /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div><div className="space-y-2"><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="Net 30, 50% deposit..." /></div><div className="space-y-2"><Label>Default currency</Label><Input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.name.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Add supplier'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Sheet open={Boolean(selectedSupplier)} onOpenChange={(open) => !open && setSelectedSupplier(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><>{selectedSupplier && <><SheetHeader className="pr-8"><div className="flex items-start justify-between gap-3"><div><SheetTitle>{selectedSupplier.name}</SheetTitle><SheetDescription>{selectedSupplier.supplier_code} · {typeLabels[selectedSupplier.supplier_type]}{selectedSupplier.category ? ` · ${selectedSupplier.category}` : ''}</SheetDescription></div><Select value={selectedSupplier.status} onValueChange={(value: Supplier['status']) => updateSupplierStatus(value)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div>{detailLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading details...</div> : <div className="space-y-6 pt-2"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</p><p className="mt-1 text-sm font-medium">{selectedSupplier.contact_person || 'No contact person'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedSupplier.email || 'No email'}</p><p className="text-xs text-muted-foreground">{selectedSupplier.phone || 'No phone'}</p></div><div className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p><p className="mt-1 text-sm font-medium">{selectedSupplier.city || 'City not set'}</p><p className="mt-1 text-xs text-muted-foreground">{selectedSupplier.country || 'Country not set'}</p></div></div>{selectedSupplier.payment_terms && <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Payment terms</p><p className="mt-1 text-sm font-medium">{selectedSupplier.payment_terms}</p></div>}{selectedSupplier.website && <a href={selectedSupplier.website.startsWith('http') ? selectedSupplier.website : `https://${selectedSupplier.website}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border/70 p-3 text-sm text-primary transition-colors hover:bg-muted/40">{selectedSupplier.website}</a>}{selectedSupplier.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selectedSupplier.notes}</p>}<section><div className="mb-3 flex items-center justify-between"><div><h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" />Contacts</h3><p className="text-xs text-muted-foreground">People connected to this supplier</p></div><Button variant="outline" size="sm" onClick={() => setContactOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>{contacts.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No additional contacts yet.</p> : <div className="space-y-2">{contacts.map((contact) => <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{contact.name}{contact.is_primary && <span className="ml-2 text-[10px] text-primary">PRIMARY</span>}</p><p className="truncate text-xs text-muted-foreground">{contact.role || contact.email || contact.phone || 'No details'}</p></div></div>)}</div>}</section></div>}</>}</></SheetContent></Sheet>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader><form onSubmit={submitContact} className="space-y-4"><div className="space-y-2"><Label>Name *</Label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div></div><div className="space-y-2"><Label>Role</Label><Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} placeholder="Sales representative" /></div><DialogFooter><Button type="submit" disabled={submitting || !contactForm.name.trim()}>Save contact</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Edit supplier</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="space-y-2"><Label>Type</Label><Select value={form.supplier_type} onValueChange={(value: Supplier['supplier_type']) => setForm({ ...form, supplier_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auction_house">Auction House</SelectItem><SelectItem value="dealer">Dealer</SelectItem><SelectItem value="wholesaler">Wholesaler</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div><div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value: Supplier['status']) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div><div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div><div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div><div className="space-y-2"><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div><div className="space-y-2"><Label>Default currency</Label><Input value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete supplier?" description="This will permanently remove the supplier. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
