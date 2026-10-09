'use client';

import { useAuth } from '@/lib/auth-provider';
import type { PermissionModule, PermissionAction, RoleName } from '@/lib/types';

export function usePermissions() {
  const { roles } = useAuth();

  const roleNames = roles.map((r) => r.name);

  const hasRole = (role: RoleName): boolean => roleNames.includes(role);

  const isSuperAdmin = (): boolean => roleNames.includes('super_admin');

  const isAdmin = (): boolean =>
    roleNames.includes('super_admin') || roleNames.includes('admin');

  const can = (module: PermissionModule, action: PermissionAction): boolean => {
    if (isSuperAdmin()) return true;
    return false;
  };

  const canView = (module: PermissionModule): boolean => {
    if (isSuperAdmin()) return true;
    const restrictedModules: Record<PermissionModule, RoleName[]> = {
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

    const allowed = restrictedModules[module] || [];
    return allowed.some((r) => roleNames.includes(r));
  };

  return { hasRole, isSuperAdmin, isAdmin, can, canView, roleNames };
}
