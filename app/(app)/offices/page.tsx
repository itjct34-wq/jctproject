'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { Building2, Clock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Office = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  city: string | null;
  timezone: string | null;
  address: string | null;
  is_active: boolean;
};

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  office_id: string | null;
};

const emptyOffice = {
  code: '',
  name: '',
  country: 'Japan',
  city: '',
  timezone: 'Asia/Tokyo',
  address: '',
  is_active: true,
};

const emptyShift = {
  office_id: '',
  code: '',
  name: '',
  start_time: '09:00',
  end_time: '18:00',
  is_active: true,
};

function hhmm(t: string | null) {
  if (!t) return '';
  return t.slice(0, 5);
}

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [officeForm, setOfficeForm] = useState(emptyOffice);
  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [officeFilter, setOfficeFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [oRes, sRes] = await Promise.all([
      supabase.from('offices').select('*').order('name'),
      supabase.from('shifts').select('*').order('start_time'),
    ]);
    if (oRes.error) toast.error(oRes.error.message);
    else setOffices((oRes.data || []) as Office[]);
    if (sRes.error) toast.error(sRes.error.message);
    else setShifts((sRes.data || []) as Shift[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name || 'Unassigned';

  const visibleShifts = useMemo(
    () => (officeFilter === 'all' ? shifts : shifts.filter((s) => s.office_id === officeFilter)),
    [shifts, officeFilter]
  );

  const openNewOffice = () => {
    setEditingOffice(null);
    setOfficeForm(emptyOffice);
    setOfficeOpen(true);
  };

  const openEditOffice = (o: Office) => {
    setEditingOffice(o);
    setOfficeForm({
      code: o.code,
      name: o.name,
      country: o.country || '',
      city: o.city || '',
      timezone: o.timezone || 'Asia/Tokyo',
      address: o.address || '',
      is_active: o.is_active,
    });
    setOfficeOpen(true);
  };

  const saveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeForm.code.trim() || !officeForm.name.trim()) return;
    setSubmitting(true);
    const row = {
      code: officeForm.code.trim().toUpperCase(),
      name: officeForm.name.trim(),
      country: officeForm.country.trim() || null,
      city: officeForm.city.trim() || null,
      timezone: officeForm.timezone.trim() || null,
      address: officeForm.address.trim() || null,
      is_active: officeForm.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingOffice
      ? await supabase.from('offices').update(row).eq('id', editingOffice.id)
      : await supabase.from('offices').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingOffice ? 'Office updated' : 'Office created');
    setOfficeOpen(false);
    load();
  };

  const removeOffice = async (o: Office) => {
    if (!confirm(`Delete office ${o.name}? Shifts stay but lose the office link.`)) return;
    const { error } = await supabase.from('offices').delete().eq('id', o.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Office deleted');
      load();
    }
  };

  const openNewShift = () => {
    setEditingShift(null);
    setShiftForm({ ...emptyShift, office_id: officeFilter === 'all' ? offices[0]?.id || '' : officeFilter });
    setShiftOpen(true);
  };

  const openEditShift = (s: Shift) => {
    setEditingShift(s);
    setShiftForm({
      office_id: s.office_id || '',
      code: s.code,
      name: s.name,
      start_time: hhmm(s.start_time) || '09:00',
      end_time: hhmm(s.end_time) || '18:00',
      is_active: s.is_active,
    });
    setShiftOpen(true);
  };

  const saveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.code.trim() || !shiftForm.name.trim() || !shiftForm.office_id) return;
    setSubmitting(true);
    const row = {
      office_id: shiftForm.office_id,
      code: shiftForm.code.trim().toUpperCase(),
      name: shiftForm.name.trim(),
      start_time: shiftForm.start_time || null,
      end_time: shiftForm.end_time || null,
      is_active: shiftForm.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingShift
      ? await supabase.from('shifts').update(row).eq('id', editingShift.id)
      : await supabase.from('shifts').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingShift ? 'Shift updated' : 'Shift created');
    setShiftOpen(false);
    load();
  };

  const removeShift = async (s: Shift) => {
    if (!confirm(`Delete shift ${s.name}?`)) return;
    const { error } = await supabase.from('shifts').delete().eq('id', s.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Shift deleted');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offices & shifts"
        description="Separate stock and staff by office and working shift"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openNewShift}>
              <Clock className="mr-1.5 h-4 w-4" /> Add shift
            </Button>
            <Button size="sm" onClick={openNewOffice}>
              <Plus className="mr-1.5 h-4 w-4" /> Add office
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offices.map((o) => {
              const count = shifts.filter((s) => s.office_id === o.id).length;
              return (
                <Card key={o.id} className="border-border/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{o.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{o.code}</p>
                        </div>
                      </div>
                      <Badge variant={o.is_active ? 'default' : 'secondary'}>{o.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[o.city, o.country].filter(Boolean).join(', ') || 'Location not set'}
                    </p>
                    {o.address && <p className="text-xs text-muted-foreground line-clamp-2">{o.address}</p>}
                    <p className="text-xs text-muted-foreground">{o.timezone || 'No timezone'} · {count} shift{count === 1 ? '' : 's'}</p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openEditOffice(o)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => removeOffice(o)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {offices.length === 0 && (
              <Card className="border-dashed border-border/80">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">No offices yet</CardContent>
              </Card>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Shifts</h2>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/60 overflow-hidden">
            {visibleShifts.length === 0 ? (
              <CardContent className="p-10 text-center text-sm text-muted-foreground">No shifts for this filter</CardContent>
            ) : (
              <div className="divide-y">
                {visibleShifts.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 p-4">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{s.name}</p>
                        <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Active' : 'Off'}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {officeName(s.office_id)} · {hhmm(s.start_time) || '—'}–{hhmm(s.end_time) || '—'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEditShift(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeShift(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={officeOpen} onOpenChange={setOfficeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOffice ? 'Edit office' : 'New office'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveOffice} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input value={officeForm.code} onChange={(e) => setOfficeForm({ ...officeForm, code: e.target.value.toUpperCase() })} required />
              </div>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={officeForm.name} onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={officeForm.city} onChange={(e) => setOfficeForm({ ...officeForm, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={officeForm.country} onChange={(e) => setOfficeForm({ ...officeForm, country: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Timezone</Label>
              <Input value={officeForm.timezone} onChange={(e) => setOfficeForm({ ...officeForm, timezone: e.target.value })} placeholder="Asia/Tokyo" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={officeForm.address} onChange={(e) => setOfficeForm({ ...officeForm, address: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={officeForm.is_active} onChange={(e) => setOfficeForm({ ...officeForm, is_active: e.target.checked })} />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOfficeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit shift' : 'New shift'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveShift} className="space-y-3">
            <div className="space-y-1">
              <Label>Office *</Label>
              <Select value={shiftForm.office_id} onValueChange={(v) => setShiftForm({ ...shiftForm, office_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input value={shiftForm.code} onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })} required />
              </div>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={shiftForm.is_active} onChange={(e) => setShiftForm({ ...shiftForm, is_active: e.target.checked })} />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShiftOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !shiftForm.office_id}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
