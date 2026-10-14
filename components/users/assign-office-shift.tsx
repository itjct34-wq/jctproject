'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import type { Office, Shift, Profile } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: Profile | null;
  onDone?: () => void;
};

export function AssignOfficeShiftDialog({ open, onOpenChange, user, onDone }: Props) {
  const { session } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [officeId, setOfficeId] = useState<string>('none');
  const [shiftId, setShiftId] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [oRes, sRes] = await Promise.all([
        supabase.from('offices').select('*').eq('is_active', true).order('name'),
        supabase.from('shifts').select('*').eq('is_active', true).order('name'),
      ]);
      setOffices((oRes.data || []) as Office[]);
      setShifts((sRes.data || []) as Shift[]);
    })();
  }, [open]);

  useEffect(() => {
    if (user) {
      setOfficeId(user.office_id || 'none');
      setShiftId(user.shift_id || 'none');
    }
  }, [user]);

  const filteredShifts = shifts.filter((s) => officeId !== 'none' && s.office_id === officeId);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const res = await fetch('/api/admin/update-user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        job_title: user.job_title,
        department: user.department,
        office_id: officeId === 'none' ? null : officeId,
        shift_id: shiftId === 'none' ? null : shiftId,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(body.error || 'Could not assign office / shift');
      return;
    }
    toast.success('Office / shift updated');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign office & shift</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{user?.full_name || user?.email}</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Office</Label>
            <Select value={officeId} onValueChange={(v) => { setOfficeId(v); setShiftId('none'); }}>
              <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name} ({o.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={shiftId} onValueChange={setShiftId} disabled={officeId === 'none'}>
              <SelectTrigger>
                <SelectValue placeholder={officeId === 'none' ? 'Select an office first' : 'Select shift'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {filteredShifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {offices.length === 0 && (
              <p className="text-xs text-muted-foreground">No offices yet — run migration SQL, then add shifts in Supabase.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
