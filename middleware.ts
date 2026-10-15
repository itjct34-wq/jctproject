import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isErpPagePath, isProtectedApiPath } from '@/lib/auth/erp-paths';
import { readAccessTokenFromRequest } from '@/lib/auth/session-cookie';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

async function sessionUserId(request: NextRequest): Promise<string | null> {
  const token = readAccessTokenFromRequest(request);
  if (!token) return null;
  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = isErpPagePath(pathname) || isProtectedApiPath(pathname);
  if (!needsAuth) return NextResponse.next();

  const userId = await sessionUserId(request);
  if (userId) return NextResponse.next();

  if (isProtectedApiPath(pathname)) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.searchParams.set('redirect', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|brand).*)'],
};
