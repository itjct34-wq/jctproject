'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Vehicle } from '@/lib/types';

type PersonOption = { id: string; label: string };

const PICKABLE_ROLES = new Set([
  'sales_agent',
  'freelancer',
  'operations',
  'manager',
  'admin',
  'super_admin',
]);

function profileLabel(p: {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  email: string | null;
}) {
  return p.full_name?.trim() || p.display_name?.trim() || p.email || p.id.slice(0, 8);
}

export type SetBidRequesterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSaved: (result: {
    vehicle: Vehicle;
    requesterId: string | null;
    requesterName: string;
  }) => void;
};

export function SetBidRequesterDialog({
  open,
  onOpenChange,
  vehicle,
  onSaved,
}: SetBidRequesterDialogProps) {
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [search, setSearch] = useState('');
  const [requesterId, setRequesterId] = useState<string>('');
  const [bidPrice, setBidPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, display_name, email, is_active')
        .eq('is_active', true)
        .order('full_name')
        .limit(250),
      supabase.from('user_roles').select('user_id, is_active, roles(name)').eq('is_active', true),
    ]);
    const profilesList = (profiles || []) as Array<{
      id: string;
      full_name: string | null;
      display_name: string | null;
      email: string | null;
    }>;
    const allowedIds = new Set<string>();
    const roleUserIds = new Set<string>();
    for (const row of roleRows || []) {
      const r = row as {
        user_id: string;
        roles?: { name: string } | { name: string }[] | null;
      };
      roleUserIds.add(r.user_id);
      const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
      if (role?.name && PICKABLE_ROLES.has(role.name)) allowedIds.add(r.user_id);
    }
    const filtered =
      roleUserIds.size > 1 && allowedIds.size > 0
        ? profilesList.filter((p) => allowedIds.has(p.id))
        : profilesList;
    setPeople(filtered.map((p) => ({ id: p.id, label: profileLabel(p) })));
    setLoadingPeople(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRequesterId(vehicle?.bid_requester_id || '');
    setBidPrice(
      vehicle?.bid_request_price != null && Number.isFinite(Number(vehicle.bid_request_price))
        ? String(vehicle.bid_request_price)
        : ''
    );
    setSearch('');
    void loadPeople();
  }, [open, vehicle?.bid_requester_id, vehicle?.bid_request_price, loadPeople]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [people, search]);

  const selectedLabel = useMemo(
    () => people.find((p) => p.id === requesterId)?.label || '',
    [people, requesterId]
  );

  const save = async (clear = false) => {
    if (!vehicle) return;
    if (!clear && !requesterId) {
      toast.error('Select a bid requester');
      return;
    }
    setSubmitting(true);
    const priceTrim = bidPrice.trim();
    const priceNum = priceTrim === '' ? null : Number(priceTrim);
    if (!clear && priceTrim !== '' && !Number.isFinite(priceNum)) {
      setSubmitting(false);
      toast.error('Bid price must be a number');
      return;
    }
    const { data, error } = await supabase.rpc('set_vehicle_bid_requester', {
      p_vehicle_id: vehicle.id,
      p_requester_id: clear ? null : requesterId,
      p_bid_price: clear ? null : priceNum,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = (data as Vehicle | null) || {
      ...vehicle,
      bid_requester_id: clear ? null : requesterId,
      bid_request_price: clear ? null : priceNum,
    };
    onSaved({
      vehicle: updated,
      requesterId: clear ? null : requesterId,
      requesterName: clear ? '' : selectedLabel || 'requester',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set bid requester</DialogTitle>
          <DialogDescription>
            {vehicle
              ? `Who wanted to buy ${vehicle.stock_number}? Bid price is optional.`
              : 'Who wanted to buy this unit? Bid price is optional.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bid-requester-search">Search</Label>
            <Input
              id="bid-requester-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or email"
              disabled={loadingPeople}
            />
          </div>
          <div className="space-y-2">
            <Label>Requester</Label>
            {loadingPeople ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users…
              </div>
            ) : (
              <Select value={requesterId || undefined} onValueChange={setRequesterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bid-request-price">Bid price (optional)</Label>
            <Input
              id="bid-request-price"
              inputMode="decimal"
              value={bidPrice}
              onChange={(e) => setBidPrice(e.target.value)}
              placeholder="Leave blank if unknown"
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            disabled={submitting || !vehicle?.bid_requester_id}
            onClick={() => void save(true)}
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting || loadingPeople} onClick={() => void save(false)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
