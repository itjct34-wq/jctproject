import {
  Gauge,
  ContactRound,
  Gavel,
  ShoppingBag,
  ClipboardList,
  FileBadge2,
  Scroll,
  WalletCards,
  BarChart3,
  ChartSpline,
  BellRing,
  UsersRound,
  Settings2,
  History,
  HandCoins,
  Newspaper,
  SlidersHorizontal,
  Radar,
  MessagesSquare,
  BadgeCheck,
  ScanQrCode,
  CloudUpload,
  Car,
  Forklift,
  Wrench,
  Route,
  Store,
  Banknote,
  BookOpen,
  Building2,
  ListTodo,
  Shield,
  Landmark,
  Ship,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RoleName, PermissionModule, PermissionAction } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module?: PermissionModule;
  /** When set, sidebar requires this action on `module` (e.g. import for Bulk upload). Defaults to view. */
  action?: PermissionAction;
  requiredRoles?: RoleName[];
  /** Hidden when the user is on sales-focused navigation (selling roles without elevated staff roles). */
  salesNavHidden?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  salesNavHidden?: boolean;
  /** When true, sidebar lists items as direct links with no section header/chevron. */
  flat?: boolean;
}

/** Roles that keep the full ERP sidebar (not sales-only). */
const ELEVATED_NAV_ROLES: RoleName[] = ['super_admin', 'admin', 'operations', 'manager', 'accounts'];

export function usesSalesFocusedNav(roleNames: RoleName[]): boolean {
  return (
    (roleNames.includes('sales_agent') || roleNames.includes('freelancer')) &&
    !roleNames.some((r) => ELEVATED_NAV_ROLES.includes(r))
  );
}

export function getNavGroupsForRoles(roleNames: RoleName[]): NavGroup[] {
  if (!usesSalesFocusedNav(roleNames)) return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.salesNavHidden),
  })).filter((group) => !group.salesNavHidden && group.items.length > 0);
}

/** First screen after login for role (sales agents land on CRM/finance, not ops dashboard). */
export function getPostLoginPath(roleNames: RoleName[]): string {
  if (usesSalesFocusedNav(roleNames)) return '/dashboard';
  return '/dashboard';
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    flat: true,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Gauge, module: 'dashboard' },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { label: 'Customers', href: '/customers', icon: ContactRound, module: 'customers' },
      { label: 'Inquiries', href: '/inquiries', icon: MessagesSquare, module: 'customers' },
      { label: 'Quotations', href: '/quotations', icon: ClipboardList, module: 'sales' },
      { label: 'Agent verification', href: '/agents', icon: BadgeCheck, module: 'users' },
      { label: 'My verification code', href: '/my-verification', icon: ScanQrCode, module: 'dashboard' },
    ],
  },
  {
    label: 'Inventory & Auctions',
    items: [
      { label: 'Bulk upload', href: '/bulk-upload', icon: CloudUpload, module: 'vehicles', action: 'import', salesNavHidden: true },
      { label: 'Cars', href: '/vehicles', icon: Car, module: 'vehicles' },
      { label: 'Machinery', href: '/vehicles?category=machinery', icon: Forklift, module: 'vehicles' },
      { label: 'Parts', href: '/vehicles?category=parts', icon: Wrench, module: 'vehicles' },
      { label: 'Third party', href: '/vehicles/third-party', icon: Store, module: 'vehicles' },
      { label: 'Stock pipeline', href: '/vehicles/lifecycle', icon: Route, module: 'vehicles' },
      { label: 'Auction', href: '/auctions', icon: Gavel, module: 'auctions', salesNavHidden: true },
      { label: 'Auction Purchases', href: '/purchases', icon: ShoppingBag, module: 'purchases', salesNavHidden: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', href: '/invoices', icon: FileBadge2, module: 'invoices' },
      { label: 'Auction invoices', href: '/auction-invoices', icon: Scroll, module: 'invoices' },
      { label: 'Remittances / T/T', href: '/payments', icon: Banknote, module: 'payments' },
      { label: 'Remittance insights', href: '/remittance-insights', icon: ChartSpline, module: 'payments' },
      { label: 'Commissions', href: '/commissions', icon: HandCoins, module: 'payments' },
      { label: 'Accounts & Expenses', href: '/expenses', icon: WalletCards, module: 'expenses', action: 'view', salesNavHidden: true },
      { label: 'Agent ledger', href: '/ledger', icon: BookOpen, module: 'payments' },
    ],
  },
  {
    label: 'Operations',
    salesNavHidden: true,
    items: [
      { label: 'Offices & shifts', href: '/offices', icon: Building2, module: 'users', salesNavHidden: true },
      { label: 'Tasks & Approvals', href: '/tasks', icon: ListTodo, module: 'tasks' },
      { label: 'Notifications', href: '/notifications', icon: BellRing, module: 'notifications' },
    ],
  },
  {
    label: 'Administration',
    salesNavHidden: true,
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
      { label: 'Blog posts', href: '/blog-admin', icon: Newspaper, module: 'settings' },
      { label: 'Users & Teams', href: '/users', icon: UsersRound, module: 'users' },
      { label: 'Permissions', href: '/permissions', icon: Shield, module: 'users', action: 'assign_roles' },
      { label: 'System Config', href: '/settings', icon: Settings2, module: 'settings' },
      { label: 'System monitor', href: '/admin/monitor', icon: Radar, requiredRoles: ['admin', 'super_admin'] },
      { label: 'Global Configuration', href: '/configuration', icon: SlidersHorizontal, module: 'settings', requiredRoles: ['super_admin'] },
      { label: 'Auction houses', href: '/configuration#auction-houses', icon: Landmark, module: 'auctions' },
      { label: 'Shipping catalogs', href: '/configuration#shipping-catalogs', icon: Ship, module: 'settings', requiredRoles: ['super_admin', 'admin'] },
      { label: 'Audit Logs', href: '/audit', icon: History, module: 'audit' },
    ],
  },
];
