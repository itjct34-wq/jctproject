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
  customers: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer'],
  vehicles: ['admin', 'operations', 'manager'],
  auctions: ['admin', 'operations', 'manager'],
  purchases: ['admin', 'operations', 'manager'],
  // sales_agent and freelancer are equivalent selling roles for create (reserve / quotes path).
  sales: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer'],
  invoices: ['admin', 'manager', 'sales_agent', 'freelancer', 'accounts'],
  // Remittance mutate (add/edit/allocate): admin, manager, accounts only — not selling roles.
  payments: ['admin', 'manager', 'accounts'],
  expenses: ['admin', 'manager', 'accounts', 'operations'],
  shipments: ['admin', 'operations', 'manager'],
  documents: ['admin', 'operations'],
  tasks: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer'],
  reports: [],
  users: ['admin'],
  settings: ['admin'],
  audit: [],
  notifications: [],
};

/** Role fallbacks for fine-grained actions when DB permissions are not loaded. */
const FINE_GRAINED_ROLES: Partial<Record<PermissionModule, Partial<Record<PermissionAction, RoleName[]>>>> = {
  payments: {
    allocate: ['admin', 'manager', 'accounts'],
  },
  vehicles: {
    import: ['admin', 'operations', 'manager'],
    reserve: ['admin', 'operations', 'manager', 'sales_agent', 'freelancer'],
    assign: ['admin', 'operations', 'manager'],
    set_bid_requester: ['admin', 'operations', 'manager'],
    edit_courier: ['admin', 'operations', 'manager'],
    edit_shipping: ['admin', 'operations', 'manager'],
  },
};

const DELETE_ROLES: RoleName[] = ['admin', 'manager'];
const APPROVE_ROLES: RoleName[] = ['admin', 'manager', 'accounts'];
const EXPORT_ROLES: RoleName[] = ['admin', 'manager', 'accounts', 'operations', 'auditor'];

function permKey(module: PermissionModule, action: PermissionAction): string {
  return `${module}.${action}`;
}

export function usePermissions() {
  const { roles, permissions, permissionsLoaded } = useAuth();
  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  const permissionSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of permissions) {
      set.add(permKey(p.module, p.action));
    }
    return set;
  }, [permissions]);

  const hasRole = (role: RoleName): boolean => roleNames.includes(role);
  const isSuperAdmin = (): boolean => roleNames.includes('super_admin');
  const isAdmin = (): boolean =>
    roleNames.includes('super_admin') || roleNames.includes('admin');

  const roleFallback = (module: PermissionModule, action: PermissionAction): boolean => {
    const fine = FINE_GRAINED_ROLES[module]?.[action];
    if (fine) return fine.some((r) => roleNames.includes(r));

    switch (action) {
      case 'view':
        return (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
      case 'create':
      case 'edit':
        return (WRITE_ROLES[module] || []).some((r) => roleNames.includes(r));
      case 'delete':
        return DELETE_ROLES.some((r) => roleNames.includes(r)) &&
          (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
      case 'approve':
      case 'confirm':
      case 'finalize':
        return APPROVE_ROLES.some((r) => roleNames.includes(r));
      case 'export':
      case 'download':
        return EXPORT_ROLES.some((r) => roleNames.includes(r)) &&
          (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
      case 'credit_note':
        return roleNames.some((r) => ['admin', 'manager', 'accounts'].includes(r));
      case 'assign':
      case 'assign_roles':
      case 'assign_teams':
        return isAdmin();
      case 'manage':
        return isAdmin();
      case 'allocate':
        return ['admin', 'manager', 'accounts'].some((r) => roleNames.includes(r as RoleName));
      case 'reserve':
        return ['admin', 'operations', 'manager', 'sales_agent', 'freelancer'].some((r) =>
          roleNames.includes(r as RoleName)
        );
      case 'set_bid_requester':
      case 'edit_courier':
      case 'edit_shipping':
      case 'import':
        return ['admin', 'operations', 'manager'].some((r) => roleNames.includes(r as RoleName));
      default:
        return (VIEW_ROLES[module] || []).some((r) => roleNames.includes(r));
    }
  };

  const can = (module: PermissionModule, action: PermissionAction): boolean => {
    if (isSuperAdmin()) return true;
    if (permissionsLoaded) {
      return permissionSet.has(permKey(module, action));
    }
    return roleFallback(module, action);
  };

  const canView = (module: PermissionModule): boolean => can(module, 'view');

  /** Add / edit remittances — payments.create or payments.edit. */
  const canMutateRemittances = (): boolean =>
    can('payments', 'create') || can('payments', 'edit');

  /** Allocate / deallocate remittances to stock. */
  const canAllocateRemittances = (): boolean =>
    can('payments', 'allocate') || canMutateRemittances();

  const canBulkUpload = (): boolean => can('vehicles', 'import') || can('vehicles', 'create');
  const canReserveStock = (): boolean => can('vehicles', 'reserve') || can('sales', 'create');
  const canAssignStock = (): boolean => can('vehicles', 'assign') || can('vehicles', 'edit');
  const canSetBidRequester = (): boolean =>
    can('vehicles', 'set_bid_requester') || can('vehicles', 'edit');
  const canEditCourier = (): boolean =>
    can('vehicles', 'edit_courier') || can('vehicles', 'edit');
  const canEditShipping = (): boolean =>
    can('vehicles', 'edit_shipping') || can('vehicles', 'edit');
  const canViewExpenses = (): boolean => can('expenses', 'view');

  const isSellingFocused = usesSalesFocusedNav(roleNames);
  const isElevatedStaff = roleNames.some((r) =>
    ['super_admin', 'admin', 'operations', 'manager', 'accounts'].includes(r)
  );

  return {
    hasRole,
    isSuperAdmin,
    isAdmin,
    can,
    canView,
    canMutateRemittances,
    canAllocateRemittances,
    canBulkUpload,
    canReserveStock,
    canAssignStock,
    canSetBidRequester,
    canEditCourier,
    canEditShipping,
    canViewExpenses,
    roleNames,
    isSellingFocused,
    isElevatedStaff,
    permissionsLoaded,
  };
}
