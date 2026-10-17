'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Search, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase/client';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  ROLE_PERMISSION_SUMMARY,
} from '@/lib/permissions-catalog';
import type {
  Permission,
  PermissionEffect,
  Profile,
  Role,
  RoleName,
  UserPermission,
} from '@/lib/types';
import { ROLE_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type UserRow = Profile & { roles: Role[] };

type OverrideState = 'inherit' | 'grant' | 'deny';

function catalogKey(module: string, action: string) {
  return `${module}.${action}`;
}

export default function PermissionsPage() {
  const { profile: currentUser, refreshProfile } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermIds, setRolePermIds] = useState<Record<string, Set<string>>>({});
  const [userOverrides, setUserOverrides] = useState<UserPermission[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const allowed = isAdmin() || isSuperAdmin();

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, userRolesRes, permsRes, rolePermsRes, overridesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('roles').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('user_roles')
        .select('user_id, role_id, is_active, roles(id, name, display_name, description, sort_order, is_system_role, created_at, updated_at)'),
      supabase.from('permissions').select('*').order('module').order('action'),
      supabase.from('role_permissions').select('role_id, permission_id'),
      supabase.from('user_permissions').select('*'),
    ]);

    if (profilesRes.error) toast.error(profilesRes.error.message);
    if (permsRes.error) toast.error(permsRes.error.message);
    if (overridesRes.error && !overridesRes.error.message.includes('schema cache')) {
      toast.error(overridesRes.error.message);
    }

    const roleMap: Record<string, Role[]> = {};
    for (const ur of userRolesRes.data || []) {
      const row = ur as { user_id: string; is_active: boolean; roles: unknown };
      if (!row.is_active || !row.roles) continue;
      if (!roleMap[row.user_id]) roleMap[row.user_id] = [];
      roleMap[row.user_id].push(row.roles as Role);
    }

    const enriched = ((profilesRes.data || []) as Profile[]).map((p) => ({
      ...p,
      roles: roleMap[p.id] || [],
    }));
    setUsers(enriched);
    setRoles((rolesRes.data || []) as Role[]);
    setAllPermissions((permsRes.data || []) as Permission[]);

    const rpMap: Record<string, Set<string>> = {};
    for (const rp of rolePermsRes.data || []) {
      const row = rp as { role_id: string; permission_id: string };
      if (!rpMap[row.role_id]) rpMap[row.role_id] = new Set();
      rpMap[row.role_id].add(row.permission_id);
    }
    setRolePermIds(rpMap);
    setUserOverrides((overridesRes.data || []) as UserPermission[]);

    setSelectedUserId((prev) => prev || enriched[0]?.id || '');
    setSelectedRoleId((prev) => {
      if (prev) return prev;
      const list = (rolesRes.data || []) as Role[];
      return list.find((r) => r.name === 'sales_agent')?.id || list[0]?.id || '';
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed) void load();
    else setLoading(false);
  }, [allowed, load]);

  const permissionByKey = useMemo(() => {
    const map = new Map<string, Permission>();
    for (const p of allPermissions) {
      map.set(catalogKey(p.module, p.action), p);
    }
    return map;
  }, [allPermissions]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.roles.some((r) => r.display_name.toLowerCase().includes(q) || r.name.includes(q))
    );
  }, [users, search]);

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;
  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const roleHasPermission = useCallback(
    (roleIds: string[], permissionId: string) =>
      roleIds.some((rid) => rolePermIds[rid]?.has(permissionId)),
    [rolePermIds]
  );

  const overrideFor = (userId: string, permissionId: string): UserPermission | undefined =>
    userOverrides.find((o) => o.user_id === userId && o.permission_id === permissionId);

  const effectiveState = (user: UserRow, module: string, action: string): {
    state: OverrideState;
    fromRole: boolean;
    effective: boolean;
  } => {
    const perm = permissionByKey.get(catalogKey(module, action));
    if (!perm) return { state: 'inherit', fromRole: false, effective: false };
    const ov = overrideFor(user.id, perm.id);
    const fromRole = roleHasPermission(
      user.roles.map((r) => r.id),
      perm.id
    );
    if (ov?.effect === 'deny') return { state: 'deny', fromRole, effective: false };
    if (ov?.effect === 'grant') return { state: 'grant', fromRole, effective: true };
    return { state: 'inherit', fromRole, effective: fromRole };
  };

  const setUserOverride = async (userId: string, module: string, action: string, next: OverrideState) => {
    const perm = permissionByKey.get(catalogKey(module, action));
    if (!perm || !currentUser) return;
    setSaving(true);
    const existing = overrideFor(userId, perm.id);
    try {
      if (next === 'inherit') {
        if (existing) {
          const { error } = await supabase.from('user_permissions').delete().eq('id', existing.id);
          if (error) throw error;
        }
      } else {
        const effect: PermissionEffect = next;
        if (existing) {
          const { error } = await supabase
            .from('user_permissions')
            .update({ effect, granted_by: currentUser.id })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('user_permissions').insert({
            user_id: userId,
            permission_id: perm.id,
            effect,
            granted_by: currentUser.id,
          });
          if (error) throw error;
        }
      }
      toast.success('Permission updated');
      await load();
      if (userId === currentUser.id) await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const toggleRolePermission = async (roleId: string, module: string, action: string, enabled: boolean) => {
    const perm = permissionByKey.get(catalogKey(module, action));
    if (!perm) {
      toast.error(`Permission ${module}.${action} is not in the database yet. Apply migration 042.`);
      return;
    }
    setSaving(true);
    try {
      if (enabled) {
        const { error } = await supabase.from('role_permissions').insert({
          role_id: roleId,
          permission_id: perm.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_id', perm.id);
        if (error) throw error;
      }
      toast.success('Role permission updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role permission');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserRole = async (userId: string, roleId: string, enabled: boolean) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      if (enabled) {
        const { error } = await supabase.from('user_roles').upsert(
          {
            user_id: userId,
            role_id: roleId,
            is_active: true,
            assigned_by: currentUser.id,
          },
          { onConflict: 'user_id,role_id' }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId);
        if (error) throw error;
      }
      toast.success('Role updated');
      await load();
      if (userId === currentUser.id) await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Only admins can manage permissions.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading permissions…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description="Assign roles and grant or deny fine-grained permissions per user. Deny always wins over a role grant."
        actions={
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              const el = document.getElementById('permissions-help');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            Help
          </Button>
        }
      />

      <Card id="permissions-help" className="border-primary/15 bg-primary/[0.03] scroll-mt-4">
        <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground sm:flex-row sm:items-start sm:gap-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p>
              <span className="font-medium text-foreground">Role</span> sets the default package.
              <span className="font-medium text-foreground"> Grant</span> adds a permission the role does not have.
              <span className="font-medium text-foreground"> Deny</span> removes it even if the role includes it.
            </p>
            <p>
              Invite users from{' '}
              <Link className="text-primary underline-offset-2 hover:underline" href="/users">
                Users &amp; Teams
              </Link>
              . Full admin guide: <code className="rounded bg-muted px-1 text-xs">docs/user-manual-permissions.md</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">User permissions</TabsTrigger>
          <TabsTrigger value="roles">Role defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Users</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto p-2 pt-0">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedUserId === u.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-primary/5'
                    )}
                  >
                    <div className="truncate font-medium">{u.full_name || u.email}</div>
                    <div
                      className={cn(
                        'truncate text-xs',
                        selectedUserId === u.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      {u.roles.map((r) => r.display_name).join(', ') || 'No role'}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedUser ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {selectedUser.full_name || selectedUser.email}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Label>Roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {roles
                          .filter((r) => r.name !== 'super_admin' || isSuperAdmin())
                          .map((role) => {
                            const on = selectedUser.roles.some((r) => r.id === role.id);
                            return (
                              <label
                                key={role.id}
                                className={cn(
                                  'inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                                  on ? 'border-primary/40 bg-primary/5' : 'border-border'
                                )}
                              >
                                <Checkbox
                                  checked={on}
                                  disabled={saving || (role.name === 'super_admin' && !isSuperAdmin())}
                                  onCheckedChange={(checked) =>
                                    void toggleUserRole(selectedUser.id, role.id, checked === true)
                                  }
                                />
                                <Badge
                                  variant="outline"
                                  className={cn('font-normal', ROLE_COLORS[role.name as RoleName])}
                                >
                                  {role.display_name}
                                </Badge>
                              </label>
                            );
                          })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser.roles
                          .map((r) => ROLE_PERMISSION_SUMMARY[r.name as RoleName])
                          .filter(Boolean)
                          .join(' · ') || 'Assign at least one role.'}
                      </p>
                    </CardContent>
                  </Card>

                  {PERMISSION_GROUPS.map((group) => {
                    const entries = PERMISSION_CATALOG.filter((e) => e.group === group);
                    return (
                      <Card key={group}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{group}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {entries.map((entry) => {
                            const { state, fromRole, effective } = effectiveState(
                              selectedUser,
                              entry.module,
                              entry.action
                            );
                            const missing = !permissionByKey.has(entry.key);
                            return (
                              <div
                                key={entry.key}
                                className="flex flex-col gap-2 rounded-lg border border-border/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{entry.label}</span>
                                    <code className="rounded bg-muted px-1 text-xs">{entry.key}</code>
                                    {effective ? (
                                      <Badge className="bg-emerald-600/90 text-xs">Allowed</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Blocked
                                      </Badge>
                                    )}
                                    {fromRole && state === 'inherit' && (
                                      <span className="text-xs text-muted-foreground">from role</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{entry.description}</p>
                                </div>
                                <Select
                                  value={state}
                                  disabled={saving || missing}
                                  onValueChange={(v) =>
                                    void setUserOverride(
                                      selectedUser.id,
                                      entry.module,
                                      entry.action,
                                      v as OverrideState
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[140px] shrink-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="inherit">Role default</SelectItem>
                                    <SelectItem value="grant">Grant</SelectItem>
                                    <SelectItem value="deny">Deny</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a user.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="w-[240px]">
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
            {selectedRole && (
              <p className="max-w-xl text-sm text-muted-foreground">
                {ROLE_PERMISSION_SUMMARY[selectedRole.name as RoleName] || selectedRole.description}
              </p>
            )}
          </div>

          {selectedRole &&
            PERMISSION_GROUPS.map((group) => {
              const entries = PERMISSION_CATALOG.filter((e) => e.group === group);
              return (
                <Card key={group}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{group}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {entries.map((entry) => {
                      const perm = permissionByKey.get(entry.key);
                      const checked = perm ? !!rolePermIds[selectedRole.id]?.has(perm.id) : false;
                      return (
                        <label
                          key={entry.key}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 px-3 py-2"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            disabled={saving || !perm || selectedRole.name === 'super_admin'}
                            onCheckedChange={(v) =>
                              void toggleRolePermission(
                                selectedRole.id,
                                entry.module,
                                entry.action,
                                v === true
                              )
                            }
                          />
                          <span>
                            <span className="block text-sm font-medium">{entry.label}</span>
                            <span className="block text-xs text-muted-foreground">{entry.description}</span>
                            <code className="text-xs text-muted-foreground">{entry.key}</code>
                          </span>
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
