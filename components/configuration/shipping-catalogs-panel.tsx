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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Ship,
  Anchor,
  Route,
  Car,
  Layers,
  Warehouse,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'lines' | 'vessels' | 'voyages' | 'makes' | 'models' | 'yards';

type CatalogRow =
  | ShippingLineRow
  | VesselRow
  | VoyageRow
  | VehicleMakeRow
  | VehicleModelRow
  | YardRow;

const TAB_LABEL: Record<Tab, string> = {
  lines: 'shipping line',
  vessels: 'vessel',
  voyages: 'voyage',
  makes: 'make',
  models: 'model',
  yards: 'yard',
};

const TABLE: Record<Tab, string> = {
  lines: 'shipping_lines',
  vessels: 'vessels',
  voyages: 'voyages',
  makes: 'vehicle_makes',
  models: 'vehicle_models',
  yards: 'yards',
};

function emptyForm(tab: Tab, makeFilter?: string): Record<string, string> {
  switch (tab) {
    case 'vessels':
      return { name: '', shipping_line_id: '', status: 'active' };
    case 'voyages':
      return { voyage_number: '', vessel_id: '', shipping_line_id: '', status: 'active' };
    case 'makes':
      return { name: '', status: 'active' };
    case 'models':
      return {
        name: '',
        make_id: makeFilter && makeFilter !== 'all' ? makeFilter : '',
        status: 'active',
      };
    case 'yards':
      return { name: '', port_name: 'Nagoya', status: 'active' };
    default:
      return { name: '', code: '', country: 'Japan', status: 'active' };
  }
}

function rowToForm(tab: Tab, row: CatalogRow): Record<string, string> {
  if (tab === 'lines') {
    const r = row as ShippingLineRow;
    return {
      name: r.name,
      code: r.code || '',
      country: r.country || '',
      status: r.status,
    };
  }
  if (tab === 'vessels') {
    const r = row as VesselRow;
    return {
      name: r.name,
      shipping_line_id: r.shipping_line_id || '',
      status: r.status,
    };
  }
  if (tab === 'voyages') {
    const r = row as VoyageRow;
    return {
      voyage_number: r.voyage_number,
      vessel_id: r.vessel_id || '',
      shipping_line_id: r.shipping_line_id || '',
      status: r.status,
    };
  }
  if (tab === 'makes') {
    const r = row as VehicleMakeRow;
    return { name: r.name, status: r.status };
  }
  if (tab === 'models') {
    const r = row as VehicleModelRow;
    return { name: r.name, make_id: r.make_id, status: r.status };
  }
  const r = row as YardRow;
  return { name: r.name, port_name: r.port_name, status: r.status };
}

function validateForm(tab: Tab, form: Record<string, string>): string | null {
  if (tab === 'lines' && !form.name.trim()) return 'Name is required';
  if (tab === 'vessels' && !form.name.trim()) return 'Vessel name is required';
  if (tab === 'voyages' && !form.voyage_number.trim()) return 'Voyage number is required';
  if (tab === 'makes' && !form.name.trim()) return 'Make name is required';
  if (tab === 'models') {
    if (!form.make_id) return 'Select a make first';
    if (!form.name.trim()) return 'Model name is required';
  }
  if (tab === 'yards') {
    if (!form.name.trim()) return 'Yard name is required';
    if (!form.port_name.trim()) return 'Export port is required';
  }
  return null;
}

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
  const [makeFilter, setMakeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ tab: Tab; row: CatalogRow } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const filteredModels = useMemo(() => {
    if (makeFilter === 'all') return models;
    return models.filter((m) => m.make_id === makeFilter);
  }, [models, makeFilter]);

  const openCreate = () => {
    if (!canEdit) {
      toast.error('You need admin or configuration (settings) edit permission.');
      return;
    }
    setEditing(null);
    setForm(emptyForm(tab, makeFilter));
    setDialogOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    if (!canEdit) return;
    setEditing(row);
    setForm(rowToForm(tab, row));
    setDialogOpen(true);
  };

  const buildPayload = (): Record<string, unknown> | null => {
    const status = form.status || 'active';
    if (tab === 'lines') {
      return {
        name: form.name.trim(),
        code: form.code?.trim() || null,
        country: form.country?.trim() || null,
        status,
        updated_at: new Date().toISOString(),
      };
    }
    if (tab === 'vessels') {
      return {
        name: form.name.trim(),
        shipping_line_id: form.shipping_line_id || null,
        status,
        updated_at: new Date().toISOString(),
      };
    }
    if (tab === 'voyages') {
      const vessel = vessels.find((x) => x.id === form.vessel_id);
      return {
        voyage_number: form.voyage_number.trim(),
        vessel_id: form.vessel_id || null,
        shipping_line_id: form.shipping_line_id || vessel?.shipping_line_id || null,
        status,
        updated_at: new Date().toISOString(),
      };
    }
    if (tab === 'makes') {
      return {
        name: form.name.trim(),
        status,
        updated_at: new Date().toISOString(),
      };
    }
    if (tab === 'models') {
      return {
        make_id: form.make_id,
        name: form.name.trim(),
        status,
        updated_at: new Date().toISOString(),
      };
    }
    if (tab === 'yards') {
      return {
        name: form.name.trim(),
        port_name: form.port_name.trim(),
        status,
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !profile) {
      toast.error('You need admin or configuration (settings) edit permission.');
      return;
    }
    const validation = validateForm(tab, form);
    if (validation) {
      toast.error(validation);
      return;
    }
    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    let error: { message: string } | null = null;

    if (editing) {
      ({ error } = await supabase
        .from(TABLE[tab])
        .update(payload)
        .eq('id', (editing as { id: string }).id));
    } else {
      ({ error } = await supabase.from(TABLE[tab]).insert({
        ...payload,
        created_by: profile.id,
      }));
    }

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? 'Updated' : 'Added');
    setDialogOpen(false);
    setEditing(null);
    await load();
  };

  const confirmDelete = async () => {
    if (!canEdit || !pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from(TABLE[pendingDelete.tab])
      .delete()
      .eq('id', (pendingDelete.row as { id: string }).id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Deleted');
    setPendingDelete(null);
    await load();
  };

  const tabs: { id: Tab; label: string; icon: typeof Ship }[] = [
    { id: 'lines', label: 'Shipping lines', icon: Ship },
    { id: 'vessels', label: 'Vessels', icon: Anchor },
    { id: 'voyages', label: 'Voyages', icon: Route },
    { id: 'makes', label: 'Makes', icon: Car },
    { id: 'models', label: 'Models', icon: Layers },
    { id: 'yards', label: 'Yards', icon: Warehouse },
  ];

  const listEmpty =
    (tab === 'lines' && lines.length === 0) ||
    (tab === 'vessels' && vessels.length === 0) ||
    (tab === 'voyages' && voyages.length === 0) ||
    (tab === 'makes' && makes.length === 0) ||
    (tab === 'models' && filteredModels.length === 0) ||
    (tab === 'yards' && yards.length === 0);

  const rowActions = (row: CatalogRow) =>
    canEdit ? (
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setPendingDelete({ tab, row })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    ) : null;

  const statusSelect = (
    <div className="space-y-1">
      <Label>Status</Label>
      <Select value={form.status || 'active'} onValueChange={(v) => setForm({ ...form, status: v })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          {tab === 'voyages' ? <SelectItem value="completed">Completed</SelectItem> : null}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card id="shipping-catalogs" className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Shipping &amp; stock catalogs</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Shipping lines, vessels, voyages, vehicle makes, models (per make), and yards linked to
            export ports. Used on invoices, shipments, and stock forms.
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add {TAB_LABEL[tab]}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">View only — need settings edit to change</p>
        )}
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

        {tab === 'models' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs space-y-1">
              <Label>Filter by make</Label>
              <Select value={makeFilter} onValueChange={setMakeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All makes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All makes</SelectItem>
                  {makes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              Add a make under Makes, then add models linked to that make here.
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : listEmpty ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No {TAB_LABEL[tab]}s yet.
            {canEdit ? ' Use Add to create one.' : ''}
            {tab === 'models' && makes.length === 0
              ? ' Create a make first under the Makes tab.'
              : ''}
          </p>
        ) : (
          <div className="max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
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
                  {rowActions(row)}
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
                  {rowActions(row)}
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
                  {rowActions(row)}
                </div>
              ))}
            {tab === 'makes' &&
              makes.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {models.filter((m) => m.make_id === row.id).length} model
                      {models.filter((m) => m.make_id === row.id).length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                  {rowActions(row)}
                </div>
              ))}
            {tab === 'models' &&
              filteredModels.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Make: {makeName[row.make_id] || '—'}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                  {rowActions(row)}
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
                  {rowActions(row)}
                </div>
              ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit' : 'Add'} {TAB_LABEL[tab]}
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
                {statusSelect}
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
                    onValueChange={(v) =>
                      setForm({ ...form, shipping_line_id: v === 'none' ? '' : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {lines.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                          {l.status !== 'active' ? ' (inactive)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {statusSelect}
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
                      {vessels.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.name}
                          {x.status !== 'active' ? ' (inactive)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {statusSelect}
              </>
            ) : null}

            {tab === 'makes' ? (
              <>
                <div className="space-y-1">
                  <Label>Make name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g. Toyota"
                  />
                </div>
                {statusSelect}
              </>
            ) : null}

            {tab === 'models' ? (
              <>
                <div className="space-y-1">
                  <Label>Make *</Label>
                  <Select
                    value={form.make_id || undefined}
                    onValueChange={(v) => setForm({ ...form, make_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={makes.length ? 'Select make' : 'Add a make first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {makes.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Model name *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g. Land Cruiser"
                  />
                </div>
                {statusSelect}
              </>
            ) : null}

            {tab === 'yards' ? (
              <>
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
                {statusSelect}
              </>
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

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {pendingDelete ? TAB_LABEL[pendingDelete.tab] : 'item'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.tab === 'makes'
                ? 'Deleting a make also deletes all models under it. This cannot be undone.'
                : 'This permanently removes the catalog entry. Seeded items can be re-added later. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
