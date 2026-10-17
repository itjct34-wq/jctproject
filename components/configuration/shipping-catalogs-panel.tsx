'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import {
  fetchShippingLines,
  fetchVessels,
  fetchVoyages,
  fetchVehicleMakes,
  fetchVehicleModels,
  type ShippingLineRow,
  type VesselRow,
  type VoyageRow,
  type VehicleMakeRow,
  type VehicleModelRow,
} from '@/lib/shipping-catalog';
import { fetchYards, type YardRow } from '@/lib/yards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Ship, Anchor, Route, Car, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'lines' | 'vessels' | 'voyages' | 'makes' | 'yards';

export function ShippingCatalogsPanel() {
  const { profile } = useAuth();
  const { isSuperAdmin, can } = usePermissions();
  const canEdit = isSuperAdmin() || can('settings', 'edit');

  const [tab, setTab] = useState<Tab>('lines');
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<ShippingLineRow[]>([]);
  const [vessels, setVessels] = useState<VesselRow[]>([]);
  const [voyages, setVoyages] = useState<VoyageRow[]>([]);
  const [makes, setMakes] = useState<VehicleMakeRow[]>([]);
  const [models, setModels] = useState<VehicleModelRow[]>([]);
  const [yards, setYards] = useState<YardRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [l, v, vo, m, mo, y] = await Promise.all([
      fetchShippingLines(supabase, false),
      fetchVessels(supabase, false),
      fetchVoyages(supabase, false),
      fetchVehicleMakes(supabase, false),
      fetchVehicleModels(supabase, undefined, false),
      fetchYards(supabase, { activeOnly: false }),
    ]);
    if (l.error) toast.error(l.error.message);
    else setLines(l.data);
    if (v.error) toast.error(v.error.message);
    else setVessels(v.data);
    if (vo.error) toast.error(vo.error.message);
    else setVoyages(vo.data);
    if (m.error) toast.error(m.error.message);
    else setMakes(m.data);
    if (mo.error) toast.error(mo.error.message);
    else setModels(mo.data);
    if (y.error) toast.error(y.error.message);
    else setYards(y.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lineName = useMemo(() => {
    const map: Record<string, string> = {};
    lines.forEach((x) => {
      map[x.id] = x.name;
    });
    return map;
  }, [lines]);

  const vesselName = useMemo(() => {
    const map: Record<string, string> = {};
    vessels.forEach((x) => {
      map[x.id] = x.name;
    });
    return map;
  }, [vessels]);

  const makeName = useMemo(() => {
    const map: Record<string, string> = {};
    makes.forEach((x) => {
      map[x.id] = x.name;
    });
    return map;
  }, [makes]);

  const openCreate = () => {
    setForm(
      tab === 'vessels'
        ? { name: '', shipping_line_id: '', status: 'active' }
        : tab === 'voyages'
          ? { voyage_number: '', vessel_id: '', shipping_line_id: '', status: 'active' }
          : tab === 'makes'
            ? { make: '', model: '', status: 'active' }
            : tab === 'yards'
              ? { name: '', port_name: 'Nagoya', status: 'active' }
              : { name: '', code: '', country: 'Japan', status: 'active' }
    );
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !profile) return;
    setSubmitting(true);
    let error: { message: string } | null = null;

    if (tab === 'lines') {
      ({ error } = await supabase.from('shipping_lines').insert({
        name: form.name.trim(),
        code: form.code?.trim() || null,
        country: form.country?.trim() || null,
        status: form.status || 'active',
        created_by: profile.id,
      }));
    } else if (tab === 'vessels') {
      ({ error } = await supabase.from('vessels').insert({
        name: form.name.trim(),
        shipping_line_id: form.shipping_line_id || null,
        status: form.status || 'active',
        created_by: profile.id,
      }));
    } else if (tab === 'voyages') {
      const vessel = vessels.find((x) => x.id === form.vessel_id);
      ({ error } = await supabase.from('voyages').insert({
        voyage_number: form.voyage_number.trim(),
        vessel_id: form.vessel_id || null,
        shipping_line_id: form.shipping_line_id || vessel?.shipping_line_id || null,
        status: form.status || 'active',
        created_by: profile.id,
      }));
    } else if (tab === 'makes') {
      let makeId = makes.find((m) => m.name.toLowerCase() === form.make.trim().toLowerCase())?.id;
      if (!makeId) {
        const ins = await supabase
          .from('vehicle_makes')
          .insert({ name: form.make.trim(), status: 'active', created_by: profile.id })
          .select('id')
          .maybeSingle();
        error = ins.error;
        makeId = (ins.data as { id: string } | null)?.id;
      }
      if (!error && makeId && form.model.trim()) {
        ({ error } = await supabase.from('vehicle_models').insert({
          make_id: makeId,
          name: form.model.trim(),
          status: 'active',
          created_by: profile.id,
        }));
      }
    } else if (tab === 'yards') {
      ({ error } = await supabase.from('yards').insert({
        name: form.name.trim(),
        port_name: form.port_name.trim(),
        status: form.status || 'active',
        created_by: profile.id,
      }));
    }

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Saved');
    setDialogOpen(false);
    await load();
  };

  const tabs: { id: Tab; label: string; icon: typeof Ship }[] = [
    { id: 'lines', label: 'Shipping lines', icon: Ship },
    { id: 'vessels', label: 'Vessels', icon: Anchor },
    { id: 'voyages', label: 'Voyages', icon: Route },
    { id: 'makes', label: 'Make / model', icon: Car },
    { id: 'yards', label: 'Yards', icon: Warehouse },
  ];

  return (
    <Card id="shipping-catalogs" className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Shipping &amp; stock catalogs</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Shipping lines, vessels, voyage numbers, vehicle make/model, and yards linked to export
            ports. Used on invoices, shipments, and stock forms.
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? 'default' : 'outline'}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="mr-1.5 h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y rounded-lg border max-h-[28rem] overflow-y-auto">
            {tab === 'lines' &&
              lines.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[row.code, row.country].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            {tab === 'vessels' &&
              vessels.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.shipping_line_id ? lineName[row.shipping_line_id] || '—' : 'No line'}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            {tab === 'voyages' &&
              voyages.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.voyage_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.vessel_id ? vesselName[row.vessel_id] || '—' : 'No vessel'}
                      {row.shipping_line_id ? ` · ${lineName[row.shipping_line_id] || ''}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            {tab === 'makes' &&
              models.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {makeName[row.make_id] || '?'} {row.name}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
            {tab === 'yards' &&
              yards.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">Port: {row.port_name}</p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add{' '}
              {tab === 'lines'
                ? 'shipping line'
                : tab === 'vessels'
                  ? 'vessel'
                  : tab === 'voyages'
                    ? 'voyage'
                    : tab === 'makes'
                      ? 'make / model'
                      : 'yard'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {tab === 'lines' ? (
              <>
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={form.code || ''}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Country</Label>
                    <Input
                      value={form.country || ''}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                </div>
              </>
            ) : null}
            {tab === 'vessels' ? (
              <>
                <div className="space-y-1">
                  <Label>Vessel name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Shipping line</Label>
                  <Select
                    value={form.shipping_line_id || 'none'}
                    onValueChange={(v) => setForm({ ...form, shipping_line_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {lines
                        .filter((l) => l.status === 'active')
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {tab === 'voyages' ? (
              <>
                <div className="space-y-1">
                  <Label>Voyage number *</Label>
                  <Input
                    value={form.voyage_number || ''}
                    onChange={(e) => setForm({ ...form, voyage_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vessel</Label>
                  <Select
                    value={form.vessel_id || 'none'}
                    onValueChange={(v) => setForm({ ...form, vessel_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vessels
                        .filter((x) => x.status === 'active')
                        .map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            {x.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {tab === 'makes' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Make *</Label>
                  <Input
                    value={form.make || ''}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    required
                    list="cfg-makes"
                  />
                  <datalist id="cfg-makes">
                    {makes.map((m) => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label>Model *</Label>
                  <Input
                    value={form.model || ''}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    required
                  />
                </div>
              </div>
            ) : null}
            {tab === 'yards' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Yard name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Export port *</Label>
                  <Input
                    value={form.port_name || ''}
                    onChange={(e) => setForm({ ...form, port_name: e.target.value })}
                    required
                    placeholder="Nagoya"
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
