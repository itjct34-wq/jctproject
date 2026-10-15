'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { usesSalesFocusedNav } from '@/lib/nav';
import type { PermissionModule, PermissionAction, RoleName } from '@/lib/types';

const VIEW_ROLES: Record<PermissionModule, RoleName[]> = {
  dashboard: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  customers: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  vehicles: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  auctions: ['admin', 'operations', 'manager', 'auditor'],
  purchases: ['admin', 'operations', 'manager', 'auditor'],
  sales: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer', 'auditor'],
  invoices: ['admin', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  payments: ['admin', 'manager', 'sales_agent', 'freelancer', 'accounts', 'auditor'],
  expenses: ['admin', 'manager', 'accounts', 'operations', 'auditor'],
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
  invoices: ['admin', 'manager', 'sales_agent', 'freelancer', 'accounts'],
  payments: ['admin', 'manager', 'accounts', 'sales_agent', 'freelancer'],
  expenses: ['admin', 'manager', 'accounts', 'operations'],
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
  const { roles, profile } = useAuth();
  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);
  const sellingWithOffice = Boolean(
    profile?.office_id && (roleNames.includes('sales_agent') || roleNames.includes('freelancer'))
  );

  const hasRole = (role: RoleName): boolean => roleNames.includes(role);
  const isSuperAdmin = (): boolean => roleNames.includes('super_admin');
  const isAdmin = (): boolean =>
    roleNames.includes('super_admin') || roleNames.includes('admin');

  const canView = (module: PermissionModule): boolean => {
    if (isSuperAdmin()) return true;
    if (module === 'expenses' && sellingWithOffice) return true;
    return (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
  };

  const can = (module: PermissionModule, action: PermissionAction): boolean => {
    if (isSuperAdmin()) return true;

    switch (action) {
      case 'view':
        return canView(module);
      case 'create':
      case 'edit':
        if (module === 'expenses' && sellingWithOffice) return true;
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

  const isSellingFocused = usesSalesFocusedNav(roleNames);
  const isElevatedStaff = roleNames.some((r) =>
    ['super_admin', 'admin', 'operations', 'manager', 'accounts'].includes(r)
  );

  return { hasRole, isSuperAdmin, isAdmin, can, canView, roleNames, isSellingFocused, isElevatedStaff };
}
