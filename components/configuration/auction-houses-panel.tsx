'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import {
  createOrGetAuctionHouse,
  fetchAuctionHouses,
  formatAuctionHouseLabel,
  type AuctionHousePick,
} from '@/lib/auction-houses';
import { supabase } from '@/lib/supabase/client';
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
import { Gavel, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

const statusStyles: Record<AuctionHousePick['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
};

const emptyForm = { name: '', city: '', country: 'Japan', status: 'active' as AuctionHousePick['status'] };

export function AuctionHousesPanel() {
  const { profile } = useAuth();
  const { can, isSuperAdmin } = usePermissions();
  const canEdit = isSuperAdmin() || can('auctions', 'create');

  const [houses, setHouses] = useState<AuctionHousePick[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AuctionHousePick | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchAuctionHouses(supabase);
    if (error) toast.error(error.message);
    else setHouses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return houses.filter((h) => {
      const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
      const matchesSearch =
        !q ||
        [h.name, h.city, h.country, h.supplier_code].filter(Boolean).some((v) =>
          String(v).toLowerCase().includes(q)
        );
      return matchesStatus && matchesSearch;
    });
  }, [houses, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (house: AuctionHousePick) => {
    setEditing(house);
    setForm({
      name: house.name,
      city: house.city || '',
      country: house.country || '',
      status: house.status,
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !canEdit || !form.name.trim()) return;
    setSubmitting(true);

    if (editing) {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: form.name.trim(),
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
        .eq('supplier_type', 'auction_house');

      setSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Auction house updated');
    } else {
      const { error } = await createOrGetAuctionHouse(supabase, {
        name: form.name,
        city: form.city,
        country: form.country,
        createdBy: profile.id,
      });
      setSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Auction house saved');
    }

    setDialogOpen(false);
    await load();
  };

  const deactivate = async (house: AuctionHousePick) => {
    if (!canEdit) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('suppliers')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', house.id)
      .eq('supplier_type', 'auction_house');
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${house.name} deactivated`);
    await load();
  };

  return (
    <Card id="auction-houses" className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4" />
            Auction houses
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable auction house directory for listings and purchases. City is the Japan export
            port (Yokohama / Nagoya / Kobe / Hakata). NS Kyushu houses are container-only (no RORO);
            all other houses allow RORO and container. Stored in <code className="text-xs">suppliers</code>{' '}
            (<code className="text-xs">supplier_type = auction_house</code>).
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add auction house
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, country, code..."
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No auction houses yet. Add one here or from the New auction listing form.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((house) => (
              <div
                key={house.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatAuctionHouseLabel(house)}</p>
                  <p className="text-xs text-muted-foreground">{house.supplier_code}</p>
                  {house.notes ? (
                    <p className="mt-1 text-xs text-amber-800">{house.notes}</p>
                  ) : null}
                </div>
                <Badge variant="outline" className={statusStyles[house.status]}>
                  {house.status}
                </Badge>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(house)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {house.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={submitting}
                        onClick={() => void deactivate(house)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit auction house' : 'Add auction house'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. USS Tokyo"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Tokyo"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="Japan"
                />
              </div>
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: AuctionHousePick['status']) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.name.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
