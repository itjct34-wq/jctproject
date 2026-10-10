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
import { Plus, Search, Users, UserCog, Shield, Loader2, Pencil, Building2, Clock } from 'lucide-react';
import { AssignOfficeShiftDialog } from '@/components/users/assign-office-shift';
import { supabase } from '@/lib/supabase/client';
import type { Profile, Role, Team, TeamMember, RoleName } from '@/lib/types';
import { ROLE_COLORS } from '@/lib/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserWithRoles extends Profile {
  roles: Role[];
  team_name?: string | null;
  office_name?: string | null;
  shift_name?: string | null;
}

export default function UsersPage() {
  const { profile: currentUser, session } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignOfficeUser, setAssignOfficeUser] = useState<UserWithRoles | null>(null);
  const [editingProfile, setEditingProfile] = useState<UserWithRoles | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', job_title: '', department: '' });
  const [teamMembers, setTeamMembers] = useState<(TeamMember & { user_name: string; user_email: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserWithRoles | null>(null);

  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: '', team: '' });
  const [teamForm, setTeamForm] = useState({ name: '', description: '', department: '', manager_id: '' });

  const loadData = useCallback(async () => {
    setLoading(true);

    const [profilesRes, rolesRes, userRolesRes, teamsRes, teamMembersRes, officesRes, shiftsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('*').order('sort_order', { ascending: true }),
      supabase.from('user_roles').select('user_id, role_id, is_active, roles(id, name, display_name, description, sort_order, is_system_role, created_at, updated_at)'),
      supabase.from('teams').select('*').order('name', { ascending: true }),
      supabase.from('team_members').select('*, profiles!inner(full_name, email)'),
      supabase.from('offices').select('id, name').eq('is_active', true).order('name'),
      supabase.from('shifts').select('id, name, office_id').eq('is_active', true).order('name'),
    ]);

    const roleMap: Record<string, Role[]> = {};
    (userRolesRes.data || []).forEach((ur: { user_id: string; is_active: boolean; roles: unknown }) => {
      if (ur.is_active && ur.roles) {
        if (!roleMap[ur.user_id]) roleMap[ur.user_id] = [];
        roleMap[ur.user_id].push(ur.roles as Role);
      }
    });

    const officeRows = (officesRes.data || []) as { id: string; name: string }[];
    const shiftRows = (shiftsRes.data || []) as { id: string; name: string; office_id: string | null }[];

    const enriched: UserWithRoles[] = (profilesRes.data as Profile[] || []).map((p) => ({
      ...p,
      roles: roleMap[p.id] || [],
      office_name: officeRows.find((o) => o.id === p.office_id)?.name || null,
      shift_name: shiftRows.find((s) => s.id === p.shift_id)?.name || null,
    }));

    setUsers(enriched);
    setRoles(rolesRes.data as Role[] || []);
    setTeams(teamsRes.data as Team[] || []);

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.role || !currentUser) return;
    setSubmitting(true);

    // User creation needs the service-role key, so it runs on the server.
    let newUserId: string;
    let tempPassword: string;
    try {
      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          full_name: inviteForm.full_name.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.user_id) {
        toast.error('Failed to create user: ' + (body.error || res.statusText));
        setSubmitting(false);
        return;
      }
      newUserId = body.user_id as string;
      tempPassword = body.temp_password as string;
    } catch (err) {
      toast.error('Failed to create user: ' + (err instanceof Error ? err.message : 'network error'));
      setSubmitting(false);
      return;
    }

    if (inviteForm.team) {
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
      `User ${inviteForm.email} created with role ${selectedRole?.display_name || ''}. ` +
        `Temporary password (shown once, share it securely): ${tempPassword}`,
      { duration: 60000 }
    );
    setInviteForm({ email: '', full_name: '', role: '', team: '' });
    setSubmitting(false);
    setInviteOpen(false);
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

  const openProfileEditor = (user: UserWithRoles) => {
    setEditingProfile(user);
    setProfileForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      department: user.department || '',
    });
  };

  const saveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setSubmitting(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name.trim() || null,
      phone: profileForm.phone.trim() || null,
      job_title: profileForm.job_title.trim() || null,
      department: profileForm.department.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingProfile.id);
    setSubmitting(false);
    if (error) { toast.error('Could not update user profile: ' + error.message); return; }
    toast.success('User profile updated');
    setEditingProfile(null);
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
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        placeholder="user@japancirculartrading.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={inviteForm.full_name}
                        onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}
                      >
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
                      <Select
                        value={inviteForm.team}
                        onValueChange={(v) => setInviteForm({ ...inviteForm, team: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={submitting || !inviteForm.email.trim() || !inviteForm.role}>
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create User'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {isAdmin() && (
              <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Team
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
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

      <AssignOfficeShiftDialog
        open={!!assignOfficeUser}
        onOpenChange={(open) => !open && setAssignOfficeUser(null)}
        user={assignOfficeUser}
        onDone={() => { setAssignOfficeUser(null); loadData(); }}
      />

      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <form onSubmit={saveUserProfile} className="space-y-4">
            <p className="text-sm text-muted-foreground">{editingProfile?.email}</p>
            <div className="space-y-2"><Label htmlFor="edit-user-full-name">Full name</Label><Input id="edit-user-full-name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="edit-user-phone">Phone</Label><Input id="edit-user-phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-user-job-title">Job title</Label><Input id="edit-user-job-title" value={profileForm.job_title} onChange={(e) => setProfileForm({ ...profileForm, job_title: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit-user-department">Department</Label><Input id="edit-user-department" value={profileForm.department} onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Profile'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                      <TableHead>Department</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Shift</TableHead>
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
                              {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name || u.email} />}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                {initials(u.full_name || u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {u.full_name || 'Unnamed'}
                              </p>
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
                          {u.department || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" /> {u.office_name || 'Unassigned'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> {u.shift_name || 'Unassigned'}
                          </span>
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
                                    <Shield className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openProfileEditor(u)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAssignOfficeUser(u)}>
                                    <Building2 className="mr-2 h-4 w-4" /> Assign Office & Shift
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRoleDialogUser(u)}>
                                    <Shield className="mr-2 h-4 w-4" /> Manage Roles
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toggleUserActive(u.id, u.is_active)}
                                    className={u.is_active ? 'text-destructive' : 'text-success'}
                                  >
                                    {u.is_active ? 'Deactivate User' : 'Activate User'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <DialogContent className="sm:max-w-md">
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
    </div>
  );
}
