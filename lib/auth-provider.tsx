'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { persistSessionCookies } from '@/lib/auth/session-cookie';
import type { Profile, Role, RoleName } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
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
  loading: true,
  signIn: async () => ({ error: 'Not initialized', roleNames: [] }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle(),
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
          .eq('user_id', data.user.id)
          .eq('is_active', true),
      ]);
      if (profileRes.data) setProfile(profileRes.data as Profile);
      const userRoles =
        rolesRes.data
          ?.map((item) => item.roles as unknown as Role)
          .filter(Boolean) ?? [];
      setRoles(userRoles);
      const roleNames = userRoles.map((r) => r.name);
      return { error: null, roleNames };
    }
    return { error: null, roleNames: [] };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    persistSessionCookies(null);
    setProfile(null);
    setRoles([]);
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
      value={{ user, session, profile, roles, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
