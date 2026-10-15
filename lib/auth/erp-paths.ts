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
  '/audit',
] as const;

export function isErpPagePath(pathname: string): boolean {
  return ERP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/api/public/')) return false;
  return true;
}
