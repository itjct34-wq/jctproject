import type { PermissionAction, PermissionModule, RoleName } from '@/lib/types';

export type PermissionCatalogEntry = {
  module: PermissionModule;
  action: PermissionAction;
  key: string;
  label: string;
  description: string;
  group: string;
};

/** Admin UI catalog — keys that matter for day-to-day ERP work. */
export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { module: 'customers', action: 'view', key: 'customers.view', label: 'View customers', description: 'See customer list and details', group: 'Sales & CRM' },
  { module: 'customers', action: 'create', key: 'customers.create', label: 'Create customers', description: 'Add new customers', group: 'Sales & CRM' },
  { module: 'customers', action: 'edit', key: 'customers.edit', label: 'Edit customers', description: 'Update customer records', group: 'Sales & CRM' },
  { module: 'sales', action: 'view', key: 'sales.view', label: 'View sales / reservations', description: 'See quotations and reservation records', group: 'Sales & CRM' },
  { module: 'sales', action: 'create', key: 'sales.create', label: 'Create sales / quotes', description: 'Create quotations and related sales rows', group: 'Sales & CRM' },
  { module: 'invoices', action: 'view', key: 'invoices.view', label: 'View invoices', description: 'See commercial and auction invoices', group: 'Sales & CRM' },
  { module: 'invoices', action: 'create', key: 'invoices.create', label: 'Create invoices', description: 'Issue invoices', group: 'Sales & CRM' },
  { module: 'invoices', action: 'edit', key: 'invoices.edit', label: 'Edit invoices', description: 'Change draft invoices', group: 'Sales & CRM' },

  { module: 'vehicles', action: 'view', key: 'vehicles.view', label: 'View stock', description: 'Browse cars, machinery, and parts', group: 'Inventory' },
  { module: 'vehicles', action: 'create', key: 'vehicles.create', label: 'Add stock', description: 'Create vehicle / stock records', group: 'Inventory' },
  { module: 'vehicles', action: 'edit', key: 'vehicles.edit', label: 'Edit stock', description: 'Change specs, pricing, and listing fields', group: 'Inventory' },
  { module: 'vehicles', action: 'delete', key: 'vehicles.delete', label: 'Delete stock', description: 'Remove stock records', group: 'Inventory' },
  { module: 'vehicles', action: 'import', key: 'vehicles.import', label: 'Bulk upload', description: 'Use Bulk upload (sheet + ZIP) and batch history', group: 'Inventory' },
  { module: 'vehicles', action: 'reserve', key: 'vehicles.reserve', label: 'Reserve stock', description: 'Reserve available units for a customer', group: 'Inventory' },
  { module: 'vehicles', action: 'assign', key: 'vehicles.assign', label: 'Assign stock', description: 'Assign available stock to a sales agent', group: 'Inventory' },
  { module: 'vehicles', action: 'set_bid_requester', key: 'vehicles.set_bid_requester', label: 'Set bid requester', description: 'Set or clear who requested the bid', group: 'Inventory' },
  { module: 'vehicles', action: 'edit_courier', key: 'vehicles.edit_courier', label: 'Edit courier', description: 'Update courier / document tracking', group: 'Inventory' },
  { module: 'vehicles', action: 'edit_shipping', key: 'vehicles.edit_shipping', label: 'Edit shipping', description: 'Update shipping stage and freight details', group: 'Inventory' },
  { module: 'auctions', action: 'view', key: 'auctions.view', label: 'View auctions', description: 'See auction listings', group: 'Inventory' },
  { module: 'auctions', action: 'create', key: 'auctions.create', label: 'Manage auctions', description: 'Create/edit auction entries', group: 'Inventory' },

  { module: 'payments', action: 'view', key: 'payments.view', label: 'View remittances', description: 'See remittance list and open TT documents (view-only; no Actions menu)', group: 'Finance' },
  { module: 'payments', action: 'create', key: 'payments.create', label: 'Add remittances', description: 'Record new remittances / T/T; enables Remittance Actions', group: 'Finance' },
  { module: 'payments', action: 'edit', key: 'payments.edit', label: 'Edit remittances', description: 'Change remittance details via Actions → Edit', group: 'Finance' },
  { module: 'payments', action: 'allocate', key: 'payments.allocate', label: 'Allocate remittances', description: 'Actions → Allocate / Deallocate remittances to stock', group: 'Finance' },
  { module: 'payments', action: 'confirm', key: 'payments.confirm', label: 'Confirm remittances', description: 'Confirm payment records', group: 'Finance' },
  { module: 'expenses', action: 'view', key: 'expenses.view', label: 'Accounts & Expenses', description: 'Open Accounts & Expenses nav and list', group: 'Finance' },
  { module: 'expenses', action: 'create', key: 'expenses.create', label: 'Create expenses', description: 'Add expense / payroll rows', group: 'Finance' },
  { module: 'expenses', action: 'edit', key: 'expenses.edit', label: 'Edit expenses', description: 'Change expense records', group: 'Finance' },
  { module: 'expenses', action: 'approve', key: 'expenses.approve', label: 'Approve expenses', description: 'Approve expense / salary payments', group: 'Finance' },

  { module: 'users', action: 'view', key: 'users.view', label: 'View users', description: 'Open Users & Teams', group: 'Administration' },
  { module: 'users', action: 'edit', key: 'users.edit', label: 'Edit users', description: 'Update profiles and invites', group: 'Administration' },
  { module: 'users', action: 'assign_roles', key: 'users.assign_roles', label: 'Assign roles', description: 'Change user roles', group: 'Administration' },
  { module: 'settings', action: 'view', key: 'settings.view', label: 'View settings', description: 'Open system config pages', group: 'Administration' },
  { module: 'audit', action: 'view', key: 'audit.view', label: 'View audit logs', description: 'Read audit trail', group: 'Administration' },
];

export const PERMISSION_GROUPS = [
  'Sales & CRM',
  'Inventory',
  'Finance',
  'Administration',
] as const;

/** Short defaults for the user manual and admin help. */
export const ROLE_PERMISSION_SUMMARY: Record<RoleName, string> = {
  super_admin: 'Everything, including global configuration.',
  admin: 'Broad ERP management; remittances, stock ops, expenses, users.',
  manager: 'Remittances, stock edit/ops, expenses, approvals.',
  accounts: 'Remittances mutate/allocate, expenses; stock view only.',
  operations: 'Stock create/edit, shipping/courier, bulk upload, expenses; no remittance mutate.',
  sales_agent: 'Customers, stock view, reserve, invoices/quotes; no remittance mutate, no shipping/courier/bid requester, no bulk upload, no expenses.',
  freelancer: 'Limited customers/tasks, stock view + reserve; no remittance mutate.',
  auditor: 'Read-only across authorized modules.',
};
