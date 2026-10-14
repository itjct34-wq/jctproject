'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase/client';
import type { Office, Profile, Role, Shift } from '@/lib/types';
import { ROLE_COLORS, type RoleName } from '@/lib/types';
import { ArrowLeft, MapPin, Pencil, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optionalPasswordUpdate, UserFormDialog, type UserFormValues } from '@/components/users/user-form-dialog';
import { toast } from 'sonner';

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { isAdmin } = usePermissions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    const [profileRes, rolesRes, officesRes, shiftsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', params.id).maybeSingle(),
      supabase
        .from('user_roles')
        .select('is_active, roles(id, name, display_name, description, sort_order, is_system_role, created_at, updated_at)')
        .eq('user_id', params.id)
        .eq('is_active', true),
      supabase.from('offices').select('*').order('name'),
      supabase.from('shifts').select('*').order('name'),
    ]);

    const user = profileRes.data as Profile | null;
    setProfile(user);
    const officeRows = (officesRes.data || []) as Office[];
    const shiftRows = (shiftsRes.data || []) as Shift[];
    setOffices(officeRows);
    setShifts(shiftRows);
    setOffice(user?.office_id ? officeRows.find((o) => o.id === user.office_id) || null : null);
    setShift(user?.shift_id ? shiftRows.find((s) => s.id === user.shift_id) || null : null);
    setRoles(
      (rolesRes.data || [])
        .map((row) => row.roles as unknown as Role)
        .filter(Boolean)
    );
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const save = async (values: UserFormValues) => {
    if (!profile) return;
    const passwordUpdate = optionalPasswordUpdate(values);
    if (passwordUpdate.error) {
      toast.error(passwordUpdate.error);
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/admin/update-user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        user_id: profile.id,
        full_name: values.full_name.trim() || null,
        phone: values.phone.trim() || null,
        job_title: values.job_title.trim() || null,
        department: values.department.trim() || null,
        office_id: values.office_id === 'none' ? null : values.office_id,
        shift_id: values.shift_id === 'none' ? null : values.shift_id,
        ...(passwordUpdate.password ? { password: passwordUpdate.password } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      toast.error(typeof body.error === 'string' ? body.error : 'Could not update profile');
      return;
    }
    toast.success(passwordUpdate.password ? 'Profile and password updated' : 'Profile updated');
    setEditOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <PageHeader title="User not found" description="This profile does not exist or you cannot view it." />
        <Button variant="outline" onClick={() => router.push('/users')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to users
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.full_name || profile.email}
        description="Staff profile, office, and shift"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/users">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Users
              </Link>
            </Button>
            {isAdmin() && (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-1.5" />
                Edit profile
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{profile.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No role assigned</span>
                  ) : (
                    roles.map((role) => (
                      <span
                        key={role.id}
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border',
                          ROLE_COLORS[role.name as RoleName]
                        )}
                      >
                        {role.display_name}
                      </span>
                    ))
                  )}
                </div>
                <Badge className="mt-2" variant={profile.is_active ? 'default' : 'secondary'}>
                  {profile.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Full name</dt>
                <dd className="font-medium">{profile.full_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Display name</dt>
                <dd className="font-medium">{profile.display_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="font-medium">{profile.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Job title</dt>
                <dd className="font-medium">{profile.job_title || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Department</dt>
                <dd className="font-medium">{profile.department || '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Office &amp; shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Office</p>
              <p className="font-medium">{office ? `${office.name} (${office.code})` : 'Not assigned'}</p>
              {office && (
                <p className="text-xs text-muted-foreground">{[office.city, office.country].filter(Boolean).join(', ')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shift</p>
              <p className="font-medium">{shift ? `${shift.name} (${shift.code})` : 'Not assigned'}</p>
              {shift && (
                <p className="text-xs text-muted-foreground">
                  {(shift.start_time || '').slice(0, 5) || '—'}–{(shift.end_time || '').slice(0, 5) || '—'}
                </p>
              )}
            </div>
            {isAdmin() && (
              <p className="text-xs text-muted-foreground">
                Use Edit profile to assign this user to an office and a shift in that office.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <UserFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        user={profile}
        roles={roles}
        teams={[]}
        offices={offices}
        shifts={shifts}
        submitting={submitting}
        onSubmit={save}
      />
    </div>
  );
}
