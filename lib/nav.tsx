import {
  LayoutDashboard,
  Users,
  Car,
  Gavel,
  ShoppingCart,
  PackageCheck,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  Ship,
  FolderOpen,
  Building2,
  CheckSquare,
  BarChart3,
  Bell,
  UserCog,
  Settings,
  ScrollText,
  BadgeCheck,
  Newspaper,
} from 'lucide-react';
import type { RoleName, PermissionModule } from '@/lib/types';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: PermissionModule;
  requiredRoles?: RoleName[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { label: 'Customers', href: '/customers', icon: Users, module: 'customers' },
      { label: 'Sales & Reservations', href: '/sales', icon: PackageCheck, module: 'sales' },
      { label: 'Quotations', href: '/quotations', icon: FileText, module: 'sales' },
      { label: 'Agent verification', href: '/agents', icon: BadgeCheck, module: 'users' },
    ],
  },
  {
    label: 'Inventory & Auctions',
    items: [
      { label: 'Vehicle Inventory', href: '/vehicles', icon: Car, module: 'vehicles' },
      { label: 'Auction Stock', href: '/auctions', icon: Gavel, module: 'auctions' },
      { label: 'Auction Purchases', href: '/purchases', icon: ShoppingCart, module: 'purchases' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', href: '/invoices', icon: Receipt, module: 'invoices' },
      { label: 'Payments / T/T', href: '/payments', icon: CreditCard, module: 'payments' },
      { label: 'Accounts & Expenses', href: '/expenses', icon: Wallet, module: 'expenses' },
    ],
  },
  {
    label: 'Export & Shipping',
    items: [
      { label: 'Shipping', href: '/shipments', icon: Ship, module: 'shipments' },
      { label: 'Export Documents', href: '/documents', icon: FolderOpen, module: 'documents' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Tasks & Approvals', href: '/tasks', icon: CheckSquare, module: 'tasks' },
      { label: 'Suppliers', href: '/suppliers', icon: Building2 },
      { label: 'Notifications', href: '/notifications', icon: Bell, module: 'notifications' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
      { label: 'Blog posts', href: '/blog-admin', icon: Newspaper, module: 'settings' },
      { label: 'Users & Teams', href: '/users', icon: UserCog, module: 'users' },
      { label: 'System Config', href: '/settings', icon: Settings, module: 'settings' },
      { label: 'Audit Logs', href: '/audit', icon: ScrollText, module: 'audit' },
    ],
  },
];
