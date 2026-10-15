import {
  LayoutDashboard,
  Users,
  Car,
  Gavel,
  ShoppingCart,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  CheckSquare,
  BarChart3,
  Bell,
  UserCog,
  User,
  Settings,
  ScrollText,
  BadgeCheck,
  BadgeDollarSign,
  BookOpen,
  Newspaper,
  MapPin,
  SlidersHorizontal,
  Inbox,
  Upload,
  Wrench,
  Cog,
} from 'lucide-react';
import type { RoleName, PermissionModule } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: PermissionModule;
  requiredRoles?: RoleName[];
  /** Hidden when the user is on sales-focused navigation (selling roles without elevated staff roles). */
  salesNavHidden?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  salesNavHidden?: boolean;
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
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { label: 'My profile', href: '/profile', icon: User },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { label: 'Customers', href: '/customers', icon: Users, module: 'customers' },
      { label: 'Inquiries', href: '/inquiries', icon: Inbox, module: 'customers' },
      { label: 'Quotations', href: '/quotations', icon: FileText, module: 'sales' },
      { label: 'Agent verification', href: '/agents', icon: BadgeCheck, module: 'users' },
      { label: 'My verification code', href: '/my-verification', icon: BadgeCheck, module: 'dashboard' },
    ],
  },
  {
    label: 'Inventory & Auctions',
    items: [
      { label: 'Bulk upload', href: '/bulk-upload', icon: Upload, module: 'vehicles' },
      { label: 'Cars', href: '/vehicles', icon: Car, module: 'vehicles' },
      { label: 'Machinery', href: '/vehicles?category=machinery', icon: Wrench, module: 'vehicles' },
      { label: 'Parts', href: '/vehicles?category=parts', icon: Cog, module: 'vehicles' },
      { label: 'Auction', href: '/auctions', icon: Gavel, module: 'auctions', salesNavHidden: true },
      { label: 'Auction Purchases', href: '/purchases', icon: ShoppingCart, module: 'purchases', salesNavHidden: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', href: '/invoices', icon: Receipt, module: 'invoices' },
      { label: 'Auction invoices', href: '/auction-invoices', icon: Gavel, module: 'invoices' },
      { label: 'Remittances / T/T', href: '/payments', icon: CreditCard, module: 'payments' },
      { label: 'Commissions', href: '/commissions', icon: BadgeDollarSign, module: 'payments' },
      { label: 'Accounts & Expenses', href: '/expenses', icon: Wallet, module: 'expenses' },
      { label: 'Agent ledger', href: '/ledger', icon: BookOpen, module: 'payments' },
    ],
  },
  {
    label: 'Operations',
    salesNavHidden: true,
    items: [
      { label: 'Offices & shifts', href: '/offices', icon: MapPin, module: 'users', salesNavHidden: true },
      { label: 'Tasks & Approvals', href: '/tasks', icon: CheckSquare, module: 'tasks' },
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
      { label: 'System Config', href: '/settings', icon: Settings, module: 'settings' },
      { label: 'Global Configuration', href: '/configuration', icon: SlidersHorizontal, module: 'settings', requiredRoles: ['super_admin'] },
      { label: 'Auction houses', href: '/configuration#auction-houses', icon: Gavel, module: 'auctions' },
      { label: 'Audit Logs', href: '/audit', icon: ScrollText, module: 'audit' },
    ],
  },
];
