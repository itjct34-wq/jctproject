'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Users, UserCog, Shield, Loader2, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { Office, Profile, Role, Shift, Team, TeamMember, RoleName } from '@/lib/types';
import { ROLE_COLORS } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AssignOfficeShiftDialog } from '@/components/users/assign-office-shift';
import { UserFormDialog, type UserFormValues } from '@/components/users/user-form-dialog';

interface UserWithRoles extends Profile {
  roles: Role[];
  team_name?: string | null;
}

export default function UsersPage() {
  const { profile: currentUser, session } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<(TeamMember & { user_name: string; user_email: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [assignUser, setAssignUser] = useState<UserWithRoles | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserWithRoles | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [teamForm, setTeamForm] = useState({ name: '', description: '', department: '', manager_id: '' });

  const loadData = useCallback(async () => {
    setLoading(true);

    const [profilesRes, rolesRes, userRolesRes, teamsRes, teamMembersRes, officesRes, shiftsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_roles').select('user_id, role_id, is_active, roles(id, name, display_name, description, sort_order, is_system_role, created_at, updated_at)'),
      supabase.from('teams').select('*').order('name', { ascending: true }),
      supabase.from('team_members').select('*, profiles!inner(full_name, email)'),
      supabase.from('offices').select('*').order('name', { ascending: true }),
      supabase.from('shifts').select('*').order('name', { ascending: true }),
    ]);

    const roleMap: Record<string, Role[]> = {};
    (userRolesRes.data || []).forEach((ur: { user_id: string; is_active: boolean; roles: unknown }) => {
      if (ur.is_active && ur.roles) {
        if (!roleMap[ur.user_id]) roleMap[ur.user_id] = [];
        roleMap[ur.user_id].push(ur.roles as Role);
      }
    });

    const enriched: UserWithRoles[] = (profilesRes.data as Profile[] || []).map((p) => ({
      ...p,
      roles: roleMap[p.id] || [],
    }));

    setUsers(enriched);
    setRoles(rolesRes.data as Role[] || []);
    setTeams(teamsRes.data as Team[] || []);
    setOffices((officesRes.data || []) as Office[]);
    setShifts((shiftsRes.data || []) as Shift[]);

    const tmEnriched = (teamMembersRes.data || []).map((tm: Record<string, unknown>) => ({
      ...tm,
      user_name: (tm.profiles as { full_name: string })?.full_name || 'Unknown',
      user_email: (tm.profiles as { email: string })?.email || '',
    })) as (TeamMember & { user_name: string; user_email: string })[];
    setTeamMembers(tmEnriched);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name || '—';
  const shiftName = (id: string | null) => shifts.find((s) => s.id === id)?.name || '—';

  const handleInvite = async (inviteForm: UserFormValues) => {
    if (!inviteForm.email.trim() || !inviteForm.role || !currentUser) return;
    if (inviteForm.password.length < 8 || inviteForm.password !== inviteForm.confirm_password) {
      toast.error('Enter a password of at least 8 characters and confirm it');
      return;
    }
    setSubmitting(true);

    let newUserId: string;
    try {
      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          full_name: inviteForm.full_name.trim(),
          phone: inviteForm.phone.trim() || null,
          job_title: inviteForm.job_title.trim() || null,
          department: inviteForm.department.trim() || null,
          office_id: inviteForm.office_id === 'none' ? null : inviteForm.office_id,
          shift_id: inviteForm.shift_id === 'none' ? null : inviteForm.shift_id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.user_id) {
        toast.error('Failed to create user: ' + (body.error || res.statusText));
        setSubmitting(false);
        return;
      }
      if (body.warning) toast.warning(body.warning);
      newUserId = body.user_id as string;
    } catch (err) {
      toast.error('Failed to create user: ' + (err instanceof Error ? err.message : 'network error'));
      setSubmitting(false);
      return;
    }

    if (inviteForm.team && inviteForm.team !== 'none') {
      await supabase.from('team_members').insert({
        team_id: inviteForm.team,
        user_id: newUserId,
      });
    }

    const selectedRole = roles.find((r) => r.id === inviteForm.role);
    if (selectedRole) {
      await supabase.from('user_roles').insert({
        user_id: newUserId,
        role_id: inviteForm.role,
        assigned_by: currentUser.id,
      });
    }

    toast.success(
      `User ${inviteForm.email} created with role ${selectedRole?.display_name || ''}. They can sign in with the password you set.`
    );
    setSubmitting(false);
    setInviteOpen(false);
    loadData();
  };

  const handleEditUser = async (values: UserFormValues) => {
    if (!editUser) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          user_id: editUser.id,
          full_name: values.full_name.trim() || null,
          phone: values.phone.trim() || null,
          job_title: values.job_title.trim() || null,
          department: values.department.trim() || null,
          office_id: values.office_id === 'none' ? null : values.office_id,
          shift_id: values.shift_id === 'none' ? null : values.shift_id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      setSubmitting(false);
      if (!res.ok) {
        toast.error(body.error || 'Could not update user');
        return;
      }
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : 'Could not update user');
      return;
    }
    toast.success('User profile updated');
    setEditUser(null);
    loadData();
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('teams').insert({
      name: teamForm.name.trim(),
      description: teamForm.description.trim() || null,
      department: teamForm.department.trim() || null,
      manager_id: teamForm.manager_id || null,
    });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to create team: ' + error.message);
      return;
    }

    toast.success('Team created successfully');
    setTeamForm({ name: '', description: '', department: '', manager_id: '' });
    setTeamOpen(false);
    loadData();
  };

  const assignRole = async (userId: string, roleId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: roleId,
      assigned_by: currentUser.id,
    });

    if (error) {
      toast.error('Failed to assign role: ' + error.message);
      return;
    }

    toast.success('Role assigned');
    setRoleDialogUser(null);
    loadData();
  };

  const removeRole = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) {
      toast.error('Failed to remove role');
      return;
    }

    toast.success('Role removed');
    loadData();
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user status');
      return;
    }

    toast.success(`User ${!isActive ? 'activated' : 'deactivated'}`);
    loadData();
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === 'all' || u.roles.some((r) => r.id === roleFilter);
    return matchesSearch && matchesRole;
  });

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Teams"
        description="Manage system users, roles, and team assignments"
        actions={
          <>
            {isAdmin() && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add User
              </Button>
            )}
            {isAdmin() && (
              <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Team
                  </Button>
                </DialogTrigger>
                <DialogContent fullscreen className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="team_name">Team Name *</Label>
                      <Input
                        id="team_name"
                        value={teamForm.name}
                        onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                        placeholder="e.g. Sales Team A"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team_desc">Description</Label>
                      <Input
                        id="team_desc"
                        value={teamForm.description}
                        onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                        placeholder="Team description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team_dept">Department</Label>
                      <Input
                        id="team_dept"
                        value={teamForm.department}
                        onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                        placeholder="e.g. Sales, Operations"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Team Manager</Label>
                      <Select
                        value={teamForm.manager_id}
                        onValueChange={(v) => setTeamForm({ ...teamForm, manager_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={submitting || !teamForm.name.trim()}>
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Team'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-1.5" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="teams">
            <UserCog className="w-4 h-4 mr-1.5" />
            Teams ({teams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {isAdmin() && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                {initials(u.full_name || u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link
                                href={`/users/${u.id}`}
                                className="text-sm font-medium text-foreground truncate hover:underline block"
                              >
                                {u.full_name || 'Unnamed'}
                              </Link>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No role assigned</span>
                            ) : (
                              u.roles.map((r) => (
                                <span
                                  key={r.id}
                                  className={cn(
                                    'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border',
                                    ROLE_COLORS[r.name as RoleName]
                                  )}
                                >
                                  {r.display_name}
                                </span>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {officeName(u.office_id)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftName(u.shift_id)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.department || '—'}
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground border-border">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(u.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        {isAdmin() && (
                          <TableCell>
                            <Dialog open={roleDialogUser?.id === u.id} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent">
                                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditUser(u)}>
                                    Edit user / profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/users/${u.id}`}>View profile</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAssignUser(u)}>
                                    Assign office & shift
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRoleDialogUser(u)}>
                                    Manage Roles
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toggleUserActive(u.id, u.is_active)}
                                    className={u.is_active ? 'text-destructive' : 'text-success'}
                                  >
                                    {u.is_active ? 'Deactivate User' : 'Activate User'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <DialogContent fullscreen className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Manage Roles — {u.full_name || u.email}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/50 min-h-12">
                                    {u.roles.length === 0 ? (
                                      <span className="text-sm text-muted-foreground">No roles assigned</span>
                                    ) : (
                                      u.roles.map((r) => (
                                        <div
                                          key={r.id}
                                          className={cn(
                                            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border',
                                            ROLE_COLORS[r.name as RoleName]
                                          )}
                                        >
                                          {r.display_name}
                                          <button
                                            onClick={() => removeRole(u.id, r.id)}
                                            className="ml-1 text-xs opacity-60 hover:opacity-100"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Add Role</Label>
                                    <Select onValueChange={(v) => assignRole(u.id, v)}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a role to add" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {roles
                                          .filter((r) => !u.roles.some((ur) => ur.id === r.id))
                                          .map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                              {r.display_name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {isSuperAdmin() && (
                                    <p className="text-xs text-muted-foreground">
                                      Note: Users cannot assign roles to themselves.
                                    </p>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No teams created yet. Click "New Team" to create one.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const members = teamMembers.filter((tm) => tm.team_id === team.id);
                const manager = users.find((u) => u.id === team.manager_id);
                return (
                  <Card key={team.id} className="border-border/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{team.name}</CardTitle>
                        {team.is_active ? (
                          <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground border-border">Inactive</Badge>
                        )}
                      </div>
                      {team.department && (
                        <p className="text-xs text-muted-foreground">{team.department}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {team.description && (
                        <p className="text-sm text-muted-foreground">{team.description}</p>
                      )}
                      {manager && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-xs text-muted-foreground">Manager:</span>
                          <span className="font-medium">{manager.full_name || manager.email}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Members ({members.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {members.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No members yet</span>
                          ) : (
                            members.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-muted text-foreground"
                              >
                                {m.is_team_lead && <Shield className="w-3 h-3 text-primary" />}
                                {m.user_name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UserFormDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        mode="create"
        roles={roles}
        teams={teams}
        offices={offices}
        shifts={shifts}
        submitting={submitting}
        onSubmit={handleInvite}
      />
      <UserFormDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        mode="edit"
        user={editUser}
        roles={roles}
        teams={teams}
        offices={offices}
        shifts={shifts}
        submitting={submitting}
        onSubmit={handleEditUser}
      />
      <AssignOfficeShiftDialog
        open={!!assignUser}
        onOpenChange={(open) => !open && setAssignUser(null)}
        user={assignUser}
        onDone={loadData}
      />
    </div>
  );
}
