export const OFFICE_EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Auction',
  'Transport',
  'Repair',
  'Insurance',
  'Office supplies',
  'Salary',
  'Commission',
  'Other',
] as const;

export type OfficeExpenseCategory = (typeof OFFICE_EXPENSE_CATEGORIES)[number];

export function currentPayrollPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function lastDayOfPayrollPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return new Date().toISOString().slice(0, 10);
  return new Date(year, month, 0).toISOString().slice(0, 10);
}

export function payrollPeriodOptions(count = 12): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return currentPayrollPeriod(d);
  });
}
