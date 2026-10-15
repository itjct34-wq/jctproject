'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import {
  createOrGetAuctionHouse,
  formatAuctionHouseLabel,
  type AuctionHousePick,
} from '@/lib/auction-houses';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const ADD_NEW_VALUE = '__add_auction_house__';

type Props = {
  value: string;
  onValueChange: (supplierId: string) => void;
  houses: AuctionHousePick[];
  onHousesChange: (houses: AuctionHousePick[]) => void;
  disabled?: boolean;
};

export function AuctionHouseSelect({
  value,
  onValueChange,
  houses,
  onHousesChange,
  disabled,
}: Props) {
  const { profile } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', country: 'Japan' });

  const handleSelect = (next: string) => {
    if (next === ADD_NEW_VALUE) {
      setForm({ name: '', city: '', country: 'Japan' });
      setAddOpen(true);
      return;
    }
    onValueChange(next);
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.name.trim()) return;
    setSubmitting(true);
    const { data, error, created } = await createOrGetAuctionHouse(supabase, {
      name: form.name,
      city: form.city,
      country: form.country,
      createdBy: profile.id,
    });
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message || 'Could not save auction house');
      return;
    }
    const merged = [...houses.filter((h) => h.id !== data.id), data].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    onHousesChange(merged);
    onValueChange(data.id);
    toast.success(created ? 'Auction house added' : 'Existing auction house selected');
    setAddOpen(false);
  };

  return (
    <>
      <Select value={value || undefined} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select auction house" />
        </SelectTrigger>
        <SelectContent>
          {houses.length === 0 ? (
            <SelectItem value="__empty__" disabled>
              No auction houses yet
            </SelectItem>
          ) : (
            houses.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {formatAuctionHouseLabel(h)}
              </SelectItem>
            ))
          )}
          <SelectSeparator />
          <SelectItem value={ADD_NEW_VALUE}>
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add auction house…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add auction house</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitNew} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Saved to the ERP directory and available on future listings.
            </p>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
                placeholder="Auction house name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.name.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & select'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
