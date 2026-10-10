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
import type { ExportDocument, Shipment } from '@/lib/types';
import { ChevronRight, FileCheck2, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from 'sonner';
import { RecordAttachments } from '@/components/shared/record-attachments';

const statusStyles: Record<ExportDocument['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', prepared: 'bg-blue-50 text-blue-700 border-blue-200', submitted: 'bg-cyan-50 text-cyan-700 border-cyan-200', received: 'bg-emerald-50 text-emerald-700 border-emerald-200', verified: 'bg-emerald-50 text-emerald-700 border-emerald-200', rejected: 'bg-red-50 text-red-700 border-red-200',
};
const typeLabels: Record<ExportDocument['document_type'], string> = {
  export_certificate: 'Export Certificate', commercial_invoice: 'Commercial Invoice', packing_list: 'Packing List', bill_of_lading: 'Bill of Lading', courier_receipt: 'Courier Receipt', inspection_certificate: 'Inspection Certificate', other: 'Other',
};
const emptyForm = { shipment_id: '', document_type: 'export_certificate' as ExportDocument['document_type'], document_number: '', issue_date: '', expiry_date: '', issuing_authority: '', notes: '' };

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<ExportDocument[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected, setSelected] = useState<ExportDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dRes, sRes] = await Promise.all([
      supabase.from('export_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('shipments').select('id, shipment_code, vessel_name').order('created_at', { ascending: false }),
    ]);
    if (dRes.error) toast.error(`Unable to load documents: ${dRes.error.message}`);
    else setDocuments((dRes.data || []) as ExportDocument[]);
    if (sRes.data) setShipments(sRes.data as Shipment[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchesType = typeFilter === 'all' || d.document_type === typeFilter;
      const matchesSearch = !q || [d.document_number, typeLabels[d.document_type]].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [documents, search, statusFilter, typeFilter]);

  const shipmentCode = (id: string | null) => id ? shipments.find((s) => s.id === id)?.shipment_code || '' : '';

  const submitDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('export_documents').insert({
      shipment_id: form.shipment_id || null, document_type: form.document_type,
      document_number: form.document_number.trim() || null, issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null, issuing_authority: form.issuing_authority.trim() || null,
      notes: form.notes.trim() || null, created_by: profile.id,
    }).select().maybeSingle();
    setSubmitting(false);
    if (error) { toast.error(`Could not create document: ${error.message}`); return; }
    toast.success('Document created'); setForm(emptyForm); setCreateOpen(false); loadData();
    if (data) setSelected(data as ExportDocument);
  };

  const openEdit = () => { if (!selected) return; setForm({ shipment_id: selected.shipment_id || '', document_type: selected.document_type, document_number: selected.document_number || '', issue_date: selected.issue_date || '', expiry_date: selected.expiry_date || '', issuing_authority: selected.issuing_authority || '', notes: selected.notes || '' }); setEditOpen(true); };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('export_documents').update({ shipment_id: form.shipment_id || null, document_type: form.document_type, document_number: form.document_number.trim() || null, issue_date: form.issue_date || null, expiry_date: form.expiry_date || null, issuing_authority: form.issuing_authority.trim() || null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, document_type: form.document_type, document_number: form.document_number.trim() || null, notes: form.notes.trim() || null };
    setSelected(updated); setDocuments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Document updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('export_documents').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Document deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const updateStatus = async (status: ExportDocument['status']) => {
    if (!selected) return;
    const { error } = await supabase.from('export_documents').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error(error.message); return; }
    const updated = { ...selected, status }; setSelected(updated);
    setDocuments((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Document status updated');
  };

  const stats = { total: documents.length, pending: documents.filter((d) => d.status === 'pending').length, verified: documents.filter((d) => d.status === 'verified').length, rejected: documents.filter((d) => d.status === 'rejected').length };

  return (
    <div className="space-y-6">
      <PageHeader title="Export Documents" description="Track export certificates, bills of lading, and shipping documents" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New document</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total documents', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Pending', value: stats.pending, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Verified', value: stats.verified, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Rejected', value: stats.rejected, tone: 'bg-red-50 text-red-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search document number, type..." /></div><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="prepared">Prepared</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><FileCheck2 className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No documents found</h3><p className="mt-1 text-sm text-muted-foreground">Create a document or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((d) => <button key={d.id} onClick={() => setSelected(d)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{typeLabels[d.document_type]}</p><Badge variant="outline" className={statusStyles[d.status]}>{d.status}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{d.document_number || 'No number'}{shipmentCode(d.shipment_id) ? ` · ${shipmentCode(d.shipment_id)}` : ''}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New document</DialogTitle></DialogHeader><form onSubmit={submitDocument} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Document type</Label><Select value={form.document_type} onValueChange={(v: ExportDocument['document_type']) => setForm({ ...form, document_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Shipment</Label><Select value={form.shipment_id} onValueChange={(v) => setForm({ ...form, shipment_id: v })}><SelectTrigger><SelectValue placeholder="Link to shipment" /></SelectTrigger><SelectContent>{shipments.map((s) => <SelectItem key={s.id} value={s.id}>{s.shipment_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Document number</Label><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} /></div><div className="space-y-2"><Label>Issuing authority</Label><Input value={form.issuing_authority} onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div><div className="space-y-2"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create document'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><>{selected && <><SheetHeader className="pr-8"><SheetTitle>{typeLabels[selected.document_type]}</SheetTitle><SheetDescription>{selected.document_number || 'No document number'}{shipmentCode(selected.shipment_id) ? ` · ${shipmentCode(selected.shipment_id)}` : ''}</SheetDescription></SheetHeader><div className="flex gap-2 pb-2"><Button size="sm" variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div className="space-y-4 pt-2"><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Status:</span><Select value={selected.status} onValueChange={(v: ExportDocument['status']) => updateStatus(v)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="prepared">Prepared</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3">{[
          { label: 'Issue date', value: selected.issue_date ? format(new Date(selected.issue_date), 'MMM d, yyyy') : 'Not set' },
          { label: 'Expiry date', value: selected.expiry_date ? format(new Date(selected.expiry_date), 'MMM d, yyyy') : 'Not set' },
          { label: 'Issuing authority', value: selected.issuing_authority || 'Not set' },
          { label: 'Document number', value: selected.document_number || 'Not set' },
        ].map((f) => <div key={f.label} className="rounded-lg border border-border/70 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p><p className="mt-1 text-sm">{f.value}</p></div>)}</div>{selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}</div><RecordAttachments entityType="documents" entityId={selected.id} /></>}</></SheetContent></Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit document</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Document type</Label><Select value={form.document_type} onValueChange={(v: ExportDocument['document_type']) => setForm({ ...form, document_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Shipment</Label><Select value={form.shipment_id} onValueChange={(v) => setForm({ ...form, shipment_id: v })}><SelectTrigger><SelectValue placeholder="Link to shipment" /></SelectTrigger><SelectContent>{shipments.map((s) => <SelectItem key={s.id} value={s.id}>{s.shipment_code}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Document number</Label><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} /></div><div className="space-y-2"><Label>Issuing authority</Label><Input value={form.issuing_authority} onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div><div className="space-y-2"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete document?" description="This will permanently remove the export document. This action cannot be undone." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}
