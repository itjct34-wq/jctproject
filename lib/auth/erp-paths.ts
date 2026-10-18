/** ERP App Router paths (under `app/(app)/`). Public marketing routes stay open. */
export const ERP_PATH_PREFIXES = [
  '/dashboard',
  '/profile',
  '/customers',
  '/inquiries',
  '/sales',
  '/quotations',
  '/agents',
  '/my-verification',
  '/bulk-upload',
  '/vehicles',
  '/auctions',
  '/purchases',
  '/invoices',
  '/auction-invoices',
  '/payments',
  '/remittance-insights',
  '/commissions',
  '/expenses',
  '/ledger',
  '/shipments',
  '/documents',
  '/offices',
  '/tasks',
  '/suppliers',
  '/notifications',
  '/reports',
  '/blog-admin',
  '/users',
  '/settings',
  '/configuration',
  '/admin',
  '/audit',
] as const;

export function isErpPagePath(pathname: string): boolean {
  return ERP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/api/public/')) return false;
  // Cron routes authenticate via CRON_SECRET Bearer token, not session cookies.
  if (pathname.startsWith('/api/cron/')) return false;
  // Temporary one-shot migration bootstrap (ONESHOT_MIGRATION_TOKEN); remove after use.
  if (pathname === '/api/admin/apply-procurement-055') return false;
  // Login is rate-limited server-side; must remain reachable without a session.
  if (pathname === '/api/auth/login' || pathname.startsWith('/api/auth/login/')) return false;
  return true;
}
