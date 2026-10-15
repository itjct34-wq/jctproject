import type { Session } from '@supabase/supabase-js';

export const SB_ACCESS_COOKIE = 'jct-sb-access-token';
export const SB_REFRESH_COOKIE = 'jct-sb-refresh-token';

function cookieBase(): string {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; SameSite=Lax${secure}`;
}

export function persistSessionCookies(session: Session | null) {
  if (typeof document === 'undefined') return;
  const base = cookieBase();
  if (!session?.access_token) {
    document.cookie = `${SB_ACCESS_COOKIE}=; ${base}; Max-Age=0`;
    document.cookie = `${SB_REFRESH_COOKIE}=; ${base}; Max-Age=0`;
    return;
  }
  const maxAge = Math.max(60, session.expires_in || 60 * 60);
  document.cookie = `${SB_ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; ${base}; Max-Age=${maxAge}`;
  if (session.refresh_token) {
    document.cookie = `${SB_REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; ${base}; Max-Age=${60 * 60 * 24 * 14}`;
  }
}

export function readAccessTokenFromRequest(request: {
  cookies: { get(name: string): { value: string } | undefined };
  headers: { get(name: string): string | null };
}): string | null {
  const header = request.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const cookie = request.cookies.get(SB_ACCESS_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie);
  } catch {
    return cookie;
  }
}
