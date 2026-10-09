'use client';

import { useAuth } from '@/lib/auth-provider';
import type { PermissionModule, PermissionAction, RoleName } from '@/lib/types';

const VIEW_ROLES: Record<PermissionModule, RoleName[]> = {
  dashboard: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  customers: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  vehicles: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  auctions: ['admin', 'operations', 'manager', 'auditor'],
  purchases: ['admin', 'operations', 'manager', 'auditor'],
  sales: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'auditor'],
  invoices: ['admin', 'manager', 'sales_agent', 'accounts', 'auditor'],
  payments: ['admin', 'manager', 'sales_agent', 'accounts', 'auditor'],
  expenses: ['admin', 'accounts', 'auditor'],
  shipments: ['admin', 'operations', 'manager', 'auditor'],
  documents: ['admin', 'operations', 'auditor'],
  tasks: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts'],
  reports: ['admin', 'operations', 'manager', 'sales_agent', 'accounts', 'auditor'],
  users: ['admin', 'manager', 'auditor'],
  settings: ['admin', 'auditor'],
  audit: ['admin', 'auditor'],
  notifications: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts'],
};

const WRITE_ROLES: Record<PermissionModule, RoleName[]> = {
  dashboard: [],
  customers: ['admin', 'operations', 'manager', 'sales_agent'],
  vehicles: ['admin', 'operations', 'manager'],
  auctions: ['admin', 'operations', 'manager'],
  purchases: ['admin', 'operations', 'manager'],
  sales: ['admin', 'operations', 'manager', 'sales_agent'],
  invoices: ['admin', 'manager', 'sales_agent', 'accounts'],
  payments: ['admin', 'manager', 'accounts'],
  expenses: ['admin', 'accounts'],
  shipments: ['admin', 'operations', 'manager'],
  documents: ['admin', 'operations'],
  tasks: ['admin', 'operations', 'manager', 'sales_agent'],
  reports: [],
  users: ['admin'],
  settings: ['admin'],
  audit: [],
  notifications: [],
};

const DELETE_ROLES: RoleName[] = ['admin', 'manager'];
const APPROVE_ROLES: RoleName[] = ['admin', 'manager', 'accounts'];
const EXPORT_ROLES: RoleName[] = ['admin', 'manager', 'accounts', 'operations', 'auditor'];

export function usePermissions() {
  const { roles } = useAuth();
  const roleNames = roles.map((r) => r.name);

  const hasRole = (role: RoleName): boolean => roleNames.includes(role);
  const isSuperAdmin = (): boolean => roleNames.includes('super_admin');
  const isAdmin = (): boolean =>
    roleNames.includes('super_admin') || roleNames.includes('admin');

  const canView = (module: PermissionModule): boolean => {
    if (isSuperAdmin()) return true;
    return (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
  };

  const can = (module: PermissionModule, action: PermissionAction): boolean => {
    if (isSuperAdmin()) return true;

    switch (action) {
      case 'view':
        return canView(module);
      case 'create':
      case 'edit':
        return (WRITE_ROLES[module] || []).some((r) => roleNames.includes(r));
      case 'delete':
        return DELETE_ROLES.some((r) => roleNames.includes(r)) && canView(module);
      case 'approve':
      case 'confirm':
      case 'finalize':
        return APPROVE_ROLES.some((r) => roleNames.includes(r));
      case 'export':
      case 'download':
        return EXPORT_ROLES.some((r) => roleNames.includes(r)) && canView(module);
      case 'credit_note':
        return roleNames.some((r) => ['admin', 'manager', 'accounts'].includes(r));
      case 'assign':
      case 'assign_roles':
      case 'assign_teams':
        return isAdmin();
      case 'manage':
        return isAdmin();
      default:
        return canView(module);
    }
  };

  return { hasRole, isSuperAdmin, isAdmin, can, canView, roleNames };
}
