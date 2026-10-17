'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { persistSessionCookies } from '@/lib/auth/session-cookie';
import type { PermissionAction, PermissionModule, Profile, Role, RoleName } from '@/lib/types';

export type EffectivePermission = { module: PermissionModule; action: PermissionAction };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  /** Effective permissions from DB (roles + user overrides). Empty until loaded. */
  permissions: EffectivePermission[];
  permissionsLoaded: boolean;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; roleNames?: RoleName[] }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  permissions: [],
  permissionsLoaded: false,
  loading: true,
  signIn: async () => ({ error: 'Not initialized', roleNames: [] }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

function mapPermissionRows(rows: unknown): EffectivePermission[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const r = row as { module?: string; action?: string };
      if (!r.module || !r.action) return null;
      return { module: r.module as PermissionModule, action: r.action as PermissionAction };
    })
    .filter(Boolean) as EffectivePermission[];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = useCallback(async (userId: string) => {
    const [profileRes, rolesRes, permsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('user_roles')
        .select(`
          is_active,
          roles (
            id,
            name,
            display_name,
            description,
            sort_order,
            is_system_role,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true),
      supabase.rpc('get_my_permissions'),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as Profile);
    }

    if (rolesRes.data) {
      const userRoles = rolesRes.data
        .map((item) => (item.roles as unknown as Role))
        .filter(Boolean);
      setRoles(userRoles);
    }

    if (!permsRes.error && permsRes.data) {
      setPermissions(mapPermissionRows(permsRes.data));
      setPermissionsLoaded(true);
    } else {
      // RPC missing (migration not applied yet) — fall back to role maps in the hook
      setPermissions([]);
      setPermissionsLoaded(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      persistSessionCookies(initialSession);
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        loadProfileAndRoles(initialSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        if (!mounted) return;
        persistSessionCookies(newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadProfileAndRoles(newSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setPermissionsLoaded(false);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileAndRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    let access_token: string;
    let refresh_token: string;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        access_token?: string;
        refresh_token?: string;
      };
      if (!res.ok || !payload.access_token || !payload.refresh_token) {
        return { error: payload.error || 'Invalid email or password' };
      }
      access_token = payload.access_token;
      refresh_token = payload.refresh_token;
    } catch {
      return { error: 'Login service temporarily unavailable' };
    }

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfileAndRoles(data.user.id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('is_active, roles(name)')
        .eq('user_id', data.user.id)
        .eq('is_active', true);
      const roleNames =
        rolesData
          ?.map((item) => (item.roles as unknown as { name: RoleName } | null)?.name)
          .filter(Boolean) as RoleName[] ?? [];
      return { error: null, roleNames };
    }
    return { error: null, roleNames: [] };
  }, [loadProfileAndRoles]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    persistSessionCookies(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    setPermissionsLoaded(false);
    setUser(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfileAndRoles(user.id);
    }
  }, [user, loadProfileAndRoles]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        permissions,
        permissionsLoaded,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
