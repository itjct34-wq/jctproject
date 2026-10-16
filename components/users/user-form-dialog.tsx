'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Office, Profile, Role, Shift, Team } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export type UserFormValues = {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  phone: string;
  job_title: string;
  department: string;
  role: string;
  team: string;
  office_id: string;
  shift_id: string;
};

export const MIN_PASSWORD_LENGTH = 8;

export function optionalPasswordUpdate(values: UserFormValues): { password?: string; error?: string } {
  if (!values.password && !values.confirm_password) return {};
  if (values.password.length < MIN_PASSWORD_LENGTH || values.password !== values.confirm_password) {
    return { error: `Enter a new password of at least ${MIN_PASSWORD_LENGTH} characters and confirm it` };
  }
  return { password: values.password };
}

const emptyForm: UserFormValues = {
  email: '',
  password: '',
  confirm_password: '',
  full_name: '',
  phone: '',
  job_title: '',
  department: '',
  role: '',
  team: 'none',
  office_id: 'none',
  shift_id: 'none',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  user?: Profile | null;
  roles: Role[];
  teams: Team[];
  offices: Office[];
  shifts: Shift[];
  submitting: boolean;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
};

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  roles,
  teams,
  offices,
  shifts,
  submitting,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<UserFormValues>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && user) {
      setForm({
        email: user.email || '',
        password: '',
        confirm_password: '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        job_title: user.job_title || '',
        department: user.department || '',
        role: '',
        team: 'none',
        office_id: user.office_id || 'none',
        shift_id: user.shift_id || 'none',
      });
      return;
    }
    setForm(emptyForm);
  }, [open, mode, user]);

  const filteredShifts = useMemo(
    () =>
      shifts.filter(
        (s) => s.is_active && form.office_id !== 'none' && s.office_id === form.office_id
      ),
    [shifts, form.office_id]
  );

  const createPasswordValid =
    form.password.length >= MIN_PASSWORD_LENGTH && form.password === form.confirm_password;
  const editPasswordTouched = form.password.length > 0 || form.confirm_password.length > 0;
  const editPasswordValid =
    !editPasswordTouched ||
    (form.password.length >= MIN_PASSWORD_LENGTH && form.password === form.confirm_password);
  const canSubmitCreate =
    Boolean(form.email.trim() && form.role) && createPasswordValid;
  const canSubmitEdit = editPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      if (form.password.length < MIN_PASSWORD_LENGTH) return;
      if (form.password !== form.confirm_password) return;
    } else if (editPasswordTouched) {
      if (form.password.length < MIN_PASSWORD_LENGTH) return;
      if (form.password !== form.confirm_password) return;
    }
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullscreen>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add user' : `Edit user — ${user?.full_name || user?.email}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="user_email">Email {mode === 'create' ? '*' : ''}</Label>
              <Input
                id="user_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@company.com"
                required={mode === 'create'}
                disabled={mode === 'edit'}
                autoComplete={mode === 'create' ? 'off' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_password">
                {mode === 'create' ? 'Password *' : 'New password'}
              </Label>
              <Input
                id="user_password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={mode === 'create' ? 'At least 8 characters' : 'Leave blank to keep current'}
                required={mode === 'create'}
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_confirm_password">
                {mode === 'create' ? 'Confirm password *' : 'Confirm new password'}
              </Label>
              <Input
                id="user_confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                placeholder="Re-enter password"
                required={mode === 'create'}
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              {form.confirm_password.length > 0 && form.password !== form.confirm_password && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
              {mode === 'edit' && form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH && (
                <p className="text-xs text-destructive">Password must be at least {MIN_PASSWORD_LENGTH} characters</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_full_name">Full name</Label>
              <Input
                id="user_full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_phone">Phone</Label>
              <Input
                id="user_phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+81…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_job">Job title</Label>
              <Input
                id="user_job"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="Sales agent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_dept">Department</Label>
              <Input
                id="user_dept"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Sales"
              />
            </div>
          </div>

          {mode === 'create' && (
            <>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={form.team} onValueChange={(v) => setForm({ ...form, team: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Office</Label>
              <Select
                value={form.office_id}
                onValueChange={(v) => setForm({ ...form, office_id: v, shift_id: 'none' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {offices.filter((o) => o.is_active).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={form.shift_id}
                onValueChange={(v) => setForm({ ...form, shift_id: v })}
                disabled={form.office_id === 'none'}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.office_id === 'none' ? 'Select an office first' : 'Select shift'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {filteredShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Shifts are scoped to the selected office so staff stay linked to both.
              </p>
            </div>
          </div>
          {offices.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No offices found. Add them under Offices &amp; shifts, then assign staff here.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || (mode === 'create' ? !canSubmitCreate : !canSubmitEdit)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : mode === 'create' ? (
                'Create user'
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
