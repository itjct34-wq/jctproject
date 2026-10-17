import {
  LayoutDashboard,
  Users,
  Gavel,
  ShoppingCart,
  FileText,
  Receipt,
  ReceiptText,
  Wallet,
  BarChart3,
  PieChart,
  Bell,
  UserCog,
  Settings,
  ScrollText,
  BadgeDollarSign,
  Newspaper,
  SlidersHorizontal,
  Activity,
  MessageSquareText,
  ShieldCheck,
  QrCode,
  FileUp,
  CarFront,
  Tractor,
  Cog,
  Workflow,
  ArrowLeftRight,
  BookUser,
  Building2,
  ListChecks,
  KeyRound,
  Landmark,
} from 'lucide-react';
import type { RoleName, PermissionModule, PermissionAction } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { label: 'Customers', href: '/customers', icon: Users, module: 'customers' },
      { label: 'Inquiries', href: '/inquiries', icon: MessageSquareText, module: 'customers' },
      { label: 'Quotations', href: '/quotations', icon: FileText, module: 'sales' },
      { label: 'Agent verification', href: '/agents', icon: ShieldCheck, module: 'users' },
      { label: 'My verification code', href: '/my-verification', icon: QrCode, module: 'dashboard' },
    ],
  },
  {
    label: 'Inventory & Auctions',
    items: [
      { label: 'Bulk upload', href: '/bulk-upload', icon: FileUp, module: 'vehicles', action: 'import', salesNavHidden: true },
      { label: 'Cars', href: '/vehicles', icon: CarFront, module: 'vehicles' },
      { label: 'Machinery', href: '/vehicles?category=machinery', icon: Tractor, module: 'vehicles' },
      { label: 'Parts', href: '/vehicles?category=parts', icon: Cog, module: 'vehicles' },
      { label: 'Stock pipeline', href: '/vehicles/lifecycle', icon: Workflow, module: 'vehicles' },
      { label: 'Auction', href: '/auctions', icon: Gavel, module: 'auctions', salesNavHidden: true },
      { label: 'Auction Purchases', href: '/purchases', icon: ShoppingCart, module: 'purchases', salesNavHidden: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', href: '/invoices', icon: Receipt, module: 'invoices' },
      { label: 'Auction invoices', href: '/auction-invoices', icon: ReceiptText, module: 'invoices' },
      { label: 'Remittances / T/T', href: '/payments', icon: ArrowLeftRight, module: 'payments' },
      { label: 'Remittance insights', href: '/remittance-insights', icon: PieChart, module: 'payments' },
      { label: 'Commissions', href: '/commissions', icon: BadgeDollarSign, module: 'payments' },
      { label: 'Accounts & Expenses', href: '/expenses', icon: Wallet, module: 'expenses', action: 'view', salesNavHidden: true },
      { label: 'Agent ledger', href: '/ledger', icon: BookUser, module: 'payments' },
    ],
  },
  {
    label: 'Operations',
    salesNavHidden: true,
    items: [
      { label: 'Offices & shifts', href: '/offices', icon: Building2, module: 'users', salesNavHidden: true },
      { label: 'Tasks & Approvals', href: '/tasks', icon: ListChecks, module: 'tasks' },
      { label: 'Notifications', href: '/notifications', icon: Bell, module: 'notifications' },
    ],
  },
  {
    label: 'Administration',
    salesNavHidden: true,
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
      { label: 'Blog posts', href: '/blog-admin', icon: Newspaper, module: 'settings' },
      { label: 'Users & Teams', href: '/users', icon: UserCog, module: 'users' },
      { label: 'Permissions', href: '/permissions', icon: KeyRound, module: 'users', action: 'assign_roles' },
      { label: 'System Config', href: '/settings', icon: Settings, module: 'settings' },
      { label: 'System monitor', href: '/admin/monitor', icon: Activity, requiredRoles: ['admin', 'super_admin'] },
      { label: 'Global Configuration', href: '/configuration', icon: SlidersHorizontal, module: 'settings', requiredRoles: ['super_admin'] },
      { label: 'Auction houses', href: '/configuration#auction-houses', icon: Landmark, module: 'auctions' },
      { label: 'Audit Logs', href: '/audit', icon: ScrollText, module: 'audit' },
    ],
  },
];
