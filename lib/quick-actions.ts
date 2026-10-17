import {
  Banknote,
  Car,
  ClipboardList,
  CloudUpload,
  FileBadge2,
  Gauge,
  ListTodo,
  MessagesSquare,
  Plus,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionAction, PermissionModule } from '@/lib/types';

export type QuickAction = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'create' | 'navigate';
  keywords?: string;
  /** When set, action is shown only if `can(module, action)` passes. */
  module?: PermissionModule;
  action?: PermissionAction;
  /** When set, action is shown only if `canView(module)` passes. */
  viewModule?: PermissionModule;
};

/** Shared Ctrl+K / mobile FAB quick actions. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-invoice',
    label: 'New invoice',
    href: '/invoices?new=1',
    icon: Plus,
    group: 'create',
    keywords: 'invoice bill create commercial',
    module: 'invoices',
    action: 'create',
  },
  {
    id: 'new-inquiry',
    label: 'New inquiry',
    href: '/inquiries',
    icon: MessagesSquare,
    group: 'create',
    keywords: 'inquiry lead crm',
    module: 'customers',
    action: 'create',
  },
  {
    id: 'new-quotation',
    label: 'New quotation',
    href: '/quotations',
    icon: ClipboardList,
    group: 'create',
    keywords: 'quote quotation offer',
    module: 'sales',
    action: 'create',
  },
  {
    id: 'add-expense',
    label: 'Add expense',
    href: '/expenses',
    icon: WalletCards,
    group: 'create',
    keywords: 'expense cost',
    module: 'expenses',
    action: 'create',
  },
  {
    id: 'upload-stock',
    label: 'Upload stock',
    href: '/bulk-upload',
    icon: CloudUpload,
    group: 'create',
    keywords: 'import bulk upload csv',
    module: 'vehicles',
    action: 'import',
  },
  {
    id: 'go-invoices',
    label: 'Invoices',
    href: '/invoices',
    icon: FileBadge2,
    group: 'navigate',
    keywords: 'invoice list',
    viewModule: 'invoices',
  },
  {
    id: 'go-stock',
    label: 'Stock',
    href: '/vehicles',
    icon: Car,
    group: 'navigate',
    keywords: 'vehicles cars inventory stock',
    viewModule: 'vehicles',
  },
  {
    id: 'go-remittances',
    label: 'Remittances / T/T',
    href: '/payments',
    icon: Banknote,
    group: 'navigate',
    keywords: 'payment remittance tt transfer',
    viewModule: 'payments',
  },
  {
    id: 'go-quotations',
    label: 'Quotations',
    href: '/quotations',
    icon: ClipboardList,
    group: 'navigate',
    keywords: 'quote quotation',
    viewModule: 'sales',
  },
  {
    id: 'go-dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: Gauge,
    group: 'navigate',
    keywords: 'home dashboard',
    viewModule: 'dashboard',
  },
  {
    id: 'go-tasks',
    label: 'Tasks',
    href: '/tasks',
    icon: ListTodo,
    group: 'navigate',
    keywords: 'tasks approvals',
    viewModule: 'tasks',
  },
];
