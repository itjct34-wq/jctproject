'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Mail, Phone, MapPin, CarFront, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-provider';
import { ERP_LIST_LIMIT } from '@/lib/erp/list-page';
import { customerContactErrorMessage, isCustomerConsigneeComplete } from '@/lib/utils/customer-contact';

type Inquiry = {
  id: string;
  inquiry_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  destination_country: string | null;
  destination_port: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  year_from: number | null;
  year_to: number | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  incoterm: string | null;
  quantity: number;
  message: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
};
type Staff = { id: string; full_name: string | null; email: string | null };

const statuses = ['new', 'in_progress', 'quoted', 'converted', 'closed', 'spam'];
const styles: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600',
  in_progress: 'bg-amber-500/10 text-amber-600',
  quoted: 'bg-emerald-500/10 text-emerald-600',
  converted: 'bg-green-500/10 text-green-600',
  closed: 'bg-muted text-muted-foreground',
  spam: 'bg-red-500/10 text-red-600',
};

const emptyConvert = { full_name: '', email: '', phone: '', address_line1: '', country: '' };

export default function InquiriesPage() {
  const { canView, isSellingFocused } = usePermissions();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [convertTarget, setConvertTarget] = useState<Inquiry | null>(null);
  const [convertForm, setConvertForm] = useState(emptyConvert);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(ERP_LIST_LIMIT);
    if (filter !== 'all') q = q.eq('status', filter);
    const [{ data, error }, { data: profiles }] = await Promise.all([
      q,
      supabase.from('profiles').select('id,full_name,email').order('full_name').limit(ERP_LIST_LIMIT),
    ]);
    if (error) toast.error('Could not load inquiries: ' + error.message);
    else setRows((data || []) as Inquiry[]);
    setStaff((profiles || []) as Staff[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (id: string, userId: string) => {
    setBusy(id);
    const { error } = await supabase
      .from('inquiries')
      .update({ assigned_to: userId === 'unassigned' ? null : userId, updated_at: new Date().toISOString() })
      .eq('id', id);
    setBusy('');
    if (error) {
      toast.error('Could not assign inquiry: ' + error.message);
      return;
    }
    toast.success('Inquiry owner updated');
    await load();
  };

  const update = async (id: string, status: string) => {
    setBusy(id);
    const dbStatus = status === 'contacted' || status === 'qualifying' ? 'in_progress' : status;
    const { error } = await supabase.from('inquiries').update({ status: dbStatus, updated_at: new Date().toISOString() }).eq('id', id);
    setBusy('');
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Inquiry status updated');
    await load();
  };

  const openConvert = (r: Inquiry) => {
    setConvertTarget(r);
    setConvertForm({
      full_name: r.full_name.trim(),
      email: r.email.trim(),
      phone: (r.phone || '').trim(),
      address_line1: '',
      country: (r.destination_country || '').trim(),
    });
  };

  const submitConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !convertTarget) {
      toast.error('Sign in again to convert this inquiry.');
      return;
    }
    const missing = isCustomerConsigneeComplete(convertForm);
    if (missing) {
      toast.error(missing);
      return;
    }
    setConverting(true);
    setBusy(convertTarget.id);
    const { data, error } = await supabase
      .from('customers')
      .insert({
        full_name: convertForm.full_name.trim(),
        company_name: convertTarget.company_name || null,
        email: convertForm.email.trim(),
        phone: convertForm.phone.trim(),
        address_line1: convertForm.address_line1.trim(),
        country: convertForm.country.trim() || convertTarget.destination_country || null,
        notes: `Converted from inquiry ${convertTarget.inquiry_code}\n${convertTarget.message}`.slice(0, 4000),
        source: 'website',
        status: 'lead',
        customer_type: convertTarget.company_name ? 'company' : 'individual',
        assigned_to: profile.id,
        created_by: profile.id,
      })
      .select('id,customer_code')
      .maybeSingle();
    if (error) {
      setConverting(false);
      setBusy('');
      toast.error(customerContactErrorMessage(error));
      return;
    }
    await supabase
      .from('inquiries')
      .update({
        status: 'converted',
        assigned_to: convertTarget.assigned_to || profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', convertTarget.id);
    await supabase.from('notifications').insert({
      user_id: profile.id,
      title: 'Inquiry converted to customer',
      message: `${convertForm.full_name} (${convertTarget.inquiry_code}) is now ${data?.customer_code || 'a customer'}.`,
      type: 'info',
      related_module: 'customers',
      related_id: data?.id || null,
      is_read: false,
    });
    setConverting(false);
    setBusy('');
    setConvertTarget(null);
    toast.success(`Customer ${data?.customer_code || ''} created`);
    await load();
  };

  const convertReady = !isCustomerConsigneeComplete(convertForm);

  if (!canView('customers')) {
    return <div className="p-10 text-center text-muted-foreground">You do not have permission to view inquiries.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales inquiries"
        description="Track public website requests from first contact through quotation and conversion."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total shown</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">New inquiries</p>
          <p className="mt-1 text-2xl font-bold">{rows.filter((r) => r.status === 'new').length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Quoted / converted</p>
          <p className="mt-1 text-2xl font-bold">{rows.filter((r) => ['quoted', 'converted'].includes(r.status)).length}</p>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter status</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All inquiries</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {isSellingFocused
              ? 'You only see inquiries assigned to you, plus unassigned new leads.'
              : 'No inquiries yet. Website submissions will appear here.'}
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {rows.map((r) => (
              <article key={r.id} className="space-y-4 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{r.full_name}</h2>
                      <Badge variant="outline" className={styles[r.status] || ''}>
                        {r.status}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{r.inquiry_code}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                      {r.company_name ? ' · ' + r.company_name : ''}
                    </p>
                  </div>
                  <Select value={r.status} disabled={busy === r.id} onValueChange={(v) => void update(r.id, v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={r.assigned_to || 'unassigned'} disabled={busy === r.id} onValueChange={(v) => void assign(r.id, v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assign owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email || p.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <a className="inline-flex items-center gap-1.5 text-primary" href={'mailto:' + r.email}>
                    <Mail className="h-3.5 w-3.5" />
                    {r.email}
                  </a>
                  {r.phone && (
                    <a className="inline-flex items-center gap-1.5 text-primary" href={'tel:' + r.phone}>
                      <Phone className="h-3.5 w-3.5" />
                      {r.phone}
                    </a>
                  )}
                  {r.destination_country && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {r.destination_country}
                      {r.destination_port ? ', ' + r.destination_port : ''}
                    </span>
                  )}
                  {(r.vehicle_make || r.vehicle_model) && (
                    <span className="inline-flex items-center gap-1.5">
                      <CarFront className="h-3.5 w-3.5" />
                      {[r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" variant="outline" disabled={busy === r.id || r.status === 'converted'} onClick={() => openConvert(r)}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Convert to customer
                  </Button>
                  <a className="text-xs text-primary underline" href={'mailto:' + r.email + '?subject=' + encodeURIComponent('JCT inquiry ' + r.inquiry_code)}>
                    Email buyer
                  </a>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Qty: {r.quantity}</span>
                  <span>Term: {r.incoterm || '—'}</span>
                  {r.budget_min != null && (
                    <span>
                      Min: {r.currency} {Number(r.budget_min).toLocaleString()}
                    </span>
                  )}
                  {r.budget_max != null && (
                    <span>
                      Max: {r.currency} {Number(r.budget_max).toLocaleString()}
                    </span>
                  )}
                  {r.year_from && (
                    <span>
                      Years: {r.year_from}
                      {r.year_to ? '–' + r.year_to : ''}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(convertTarget)} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitConvert} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Consignee details are required to ship vehicles. Phone and email must be unique.
            </p>
            <div className="space-y-2">
              <Label>Consignee Name *</Label>
              <Input value={convertForm.full_name} onChange={(e) => setConvertForm({ ...convertForm, full_name: e.target.value })} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact *</Label>
                <Input value={convertForm.phone} onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })} required placeholder="+923353522447" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={convertForm.email} onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address *</Label>
              <Textarea
                value={convertForm.address_line1}
                onChange={(e) => setConvertForm({ ...convertForm, address_line1: e.target.value })}
                rows={2}
                required
                placeholder="Shipping address"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={convertForm.country} onChange={(e) => setConvertForm({ ...convertForm, country: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConvertTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={converting || !convertReady}>
                {converting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create customer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
