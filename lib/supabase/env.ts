/**
 * Supabase env for client creation. During `next build` static prerender, env vars
 * may be absent; placeholders satisfy createClient validation without network calls.
 */
const BUILD_PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const BUILD_PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1wbGFjZWhvbGRlciJ9.placeholder';
const BUILD_PLACEHOLDER_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1wbGFjZWhvbGRlci1zZXJ2aWNlIn0.placeholder';

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || BUILD_PLACEHOLDER_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || BUILD_PLACEHOLDER_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || BUILD_PLACEHOLDER_SERVICE_KEY;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
