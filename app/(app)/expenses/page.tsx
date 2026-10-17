'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { Expense, Office, Profile, UserPayroll, Vehicle } from '@/lib/types';
import { CheckCircle2, ChevronRight, Loader2, Pencil, Plus, Receipt, Search, Trash2, Wallet, XCircle } from 'lucide-react';
import { CurrencySelect } from '@/components/ui/currency-select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErpEmptyState } from '@/components/shared/erp-empty-state';
import { toast } from 'sonner';
import { AttachmentCountBadge, RecordAttachments, useAttachmentCounts } from '@/components/shared/record-attachments';
import { currentPayrollPeriod, lastDayOfPayrollPeriod, OFFICE_EXPENSE_CATEGORIES, payrollPeriodOptions } from '@/lib/office-expenses';
import { formatMoney } from '@/lib/utils/format';

const statusStyles: Record<Expense['status'], string> = {
  pending: 'border-warning/45 bg-warning/15 text-warning',
  approved: 'border-success/40 bg-success/15 text-success',
  rejected: 'border-destructive/40 bg-destructive/15 text-destructive',
  paid: 'border-info/40 bg-info/15 text-info',
};

const emptyForm = {
  category: 'Rent',
  vehicle_id: 'none',
  office_id: '',
  expense_date: '',
  amount: '',
  currency: 'JPY',
  payment_method: 'bank_transfer' as NonNullable<Expense['payment_method']>,
  vendor: '',
  notes: '',
};

function personName(p: Pick<Profile, 'full_name' | 'display_name' | 'email'> | undefined) {
  if (!p) return 'Staff';
  return p.full_name?.trim() || p.display_name?.trim() || p.email;
}

export default function ExpensesPage() {
  const { profile } = useAuth();
  const { can, isAdmin, hasRole, isSellingFocused, canViewExpenses } = usePermissions();
  const canCreate = can('expenses', 'create');
  const canPaySalary = isAdmin() || hasRole('manager') || hasRole('accounts') || can('expenses', 'approve');
  const expensesAllowed = canViewExpenses() || isAdmin();
  const lockedOfficeId = isSellingFocused ? profile?.office_id || '' : '';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [payroll, setPayroll] = useState<Record<string, UserPayroll>>({});
  const [selected, setSelected] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payingUser, setPayingUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [payrollPeriod, setPayrollPeriod] = useState(currentPayrollPeriod());
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const expenseIds = useMemo(() => expenses.map((e) => e.id), [expenses]);
  const { counts: attachmentCounts, setCount: setAttachmentCount } = useAttachmentCounts('expenses', expenseIds);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [eRes, vRes, oRes, pRes, payRes] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('vehicles').select('id, stock_number, make, model').order('created_at', { ascending: false }),
      supabase.from('offices').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, full_name, display_name, email, office_id, is_active').eq('is_active', true).limit(250),
      canPaySalary ? supabase.from('user_payroll').select('*') : Promise.resolve({ data: [] as UserPayroll[], error: null }),
    ]);
    if (eRes.error) toast.error(`Unable to load expenses: ${eRes.error.message}`);
    else setExpenses((eRes.data || []) as Expense[]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    if (oRes.data) setOffices(oRes.data as Office[]);
    if (pRes.data) setStaff(pRes.data as Profile[]);
    if (payRes.data) {
      const map: Record<string, UserPayroll> = {};
      for (const row of payRes.data as UserPayroll[]) map[row.user_id] = row;
      setPayroll(map);
    }
    setLoading(false);
  }, [canPaySalary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (lockedOfficeId) setOfficeFilter(lockedOfficeId);
  }, [lockedOfficeId]);

  const categories = useMemo(() => {
    const fromRows = expenses.map((e) => e.category);
    return Array.from(new Set([...OFFICE_EXPENSE_CATEGORIES, ...fromRows])).sort();
  }, [expenses]);

  const officeName = (id: string | null | undefined) => offices.find((o) => o.id === id)?.name || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const officeId = lockedOfficeId || officeFilter;
    return expenses.filter((e) => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesOffice = officeId === 'all' || e.office_id === officeId;
      const matchesSearch =
        !q ||
        [e.expense_code, e.vendor, e.category, officeName(e.office_id)].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesCategory && matchesOffice && matchesSearch;
    });
  }, [expenses, search, statusFilter, categoryFilter, officeFilter, lockedOfficeId, offices]);

  const vehicleLabel = (id: string | null) => {
    const v = vehicles.find((row) => row.id === id);
    return v ? `${v.make} ${v.model} (${v.stock_number})` : '';
  };

  const defaultOffice = lockedOfficeId || profile?.office_id || offices[0]?.id || '';

  const openCreate = () => {
    setForm({ ...emptyForm, office_id: defaultOffice });
    setCreateOpen(true);
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.category.trim() || !form.amount || !form.office_id) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category: form.category.trim(),
        vehicle_id: form.vehicle_id === 'none' ? null : form.vehicle_id || null,
        office_id: form.office_id,
        expense_date: form.expense_date || new Date().toISOString().split('T')[0],
        amount: Number(form.amount) || 0,
        currency: form.currency,
        payment_method: form.payment_method,
        vendor: form.vendor.trim() || null,
        notes: form.notes.trim() || null,
        created_by: profile.id,
      })
      .select()
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast.error(`Could not create expense: ${error.message}`);
      return;
    }
    toast.success('Expense recorded');
    setForm(emptyForm);
    setCreateOpen(false);
    loadData();
    if (data) setSelected(data as Expense);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({
      category: selected.category,
      vehicle_id: selected.vehicle_id || 'none',
      office_id: selected.office_id || defaultOffice,
      expense_date: selected.expense_date,
      amount: String(selected.amount),
      currency: selected.currency,
      payment_method: selected.payment_method || 'bank_transfer',
      vendor: selected.vendor || '',
      notes: selected.notes || '',
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !form.office_id) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('expenses')
      .update({
        category: form.category.trim(),
        vehicle_id: form.vehicle_id === 'none' ? null : form.vehicle_id || null,
        office_id: form.office_id,
        expense_date: form.expense_date,
        amount: Number(form.amount) || 0,
        currency: form.currency,
        payment_method: form.payment_method,
        vendor: form.vendor.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    const updated: Expense = {
      ...selected,
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      currency: form.currency,
      office_id: form.office_id,
      vendor: form.vendor.trim() || null,
      notes: form.notes.trim() || null,
    };
    setSelected(updated);
    setExpenses((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Expense updated');
    setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('expenses').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) {
      toast.error(`Could not delete: ${error.message}`);
      return;
    }
    toast.success('Expense deleted');
    setDeleteOpen(false);
    setSelected(null);
    loadData();
  };

  const approveExpense = async () => {
    if (!selected || !profile) return;
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...selected, status: 'approved' as const };
    setSelected(updated);
    setExpenses((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Expense approved');
  };

  const rejectExpense = async () => {
    if (!selected) return;
    const { error } = await supabase.from('expenses').update({ status: 'rejected' }).eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...selected, status: 'rejected' as const };
    setSelected(updated);
    setExpenses((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Expense rejected');
  };

  const markPaid = async () => {
    if (!selected) return;
    const { error } = await supabase.from('expenses').update({ status: 'paid' }).eq('id', selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = { ...selected, status: 'paid' as const };
    setSelected(updated);
    setExpenses((items) => items.map((i) => (i.id === updated.id ? updated : i)));
    toast.success('Expense marked as paid');
  };

  const salaryStaff = useMemo(
    () => staff.filter((s) => Number(payroll[s.id]?.salary_amount || 0) > 0),
    [staff, payroll]
  );

  const paidSalaryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of expenses) {
      if (e.payroll_user_id && e.payroll_period === payrollPeriod) ids.add(e.payroll_user_id);
    }
    return ids;
  }, [expenses, payrollPeriod]);

  const paySalary = async (userId: string) => {
    if (!profile || !canPaySalary) return;
    const row = payroll[userId];
    const person = staff.find((s) => s.id === userId);
    if (!row || !person) return;
    setPayingUser(userId);
    const { error } = await supabase.from('expenses').insert({
      category: 'Salary',
      office_id: person.office_id || null,
      payroll_user_id: userId,
      payroll_period: payrollPeriod,
      expense_date: lastDayOfPayrollPeriod(payrollPeriod),
      amount: Number(row.salary_amount) || 0,
      currency: row.salary_currency || 'PKR',
      payment_method: 'bank_transfer',
      vendor: personName(person),
      status: 'paid',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
      notes: `Monthly salary ${payrollPeriod}`,
      created_by: profile.id,
    });
    setPayingUser(null);
    if (error) {
      if (error.code === '23505') toast.error(`Salary already posted for ${personName(person)} in ${payrollPeriod}`);
      else toast.error(error.message);
      return;
    }
    toast.success(`Paid salary for ${personName(person)}`);
    loadData();
  };

  const payAllUnpaid = async () => {
    const pending = salaryStaff.filter((s) => !paidSalaryIds.has(s.id));
    for (const person of pending) {
      await paySalary(person.id);
    }
  };

  const stats = {
    total: filtered.length,
    pending: filtered.filter((e) => e.status === 'pending').length,
    approved: filtered.filter((e) => e.status === 'approved').length,
    totalAmount: filtered.filter((e) => e.status === 'paid' || e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
  };

  const expenseFormFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Office *</Label>
          <Select
            value={form.office_id}
            onValueChange={(office_id) => setForm({ ...form, office_id })}
            disabled={Boolean(lockedOfficeId)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select office" />
            </SelectTrigger>
            <SelectContent>
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category *</Label>
          <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFICE_EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Vehicle</Label>
          <Select value={form.vehicle_id} onValueChange={(vehicle_id) => setForm({ ...form, vehicle_id })}>
            <SelectTrigger>
              <SelectValue placeholder="Optional stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vehicle</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.make} {v.model} ({v.stock_number})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Vendor</Label>
          <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Expense date</Label>
          <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Amount *</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <CurrencySelect value={form.currency} onValueChange={(currency) => setForm({ ...form, currency })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Payment method</Label>
        <Select
          value={form.payment_method}
          onValueChange={(payment_method: NonNullable<Expense['payment_method']>) => setForm({ ...form, payment_method })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="credit_card">Credit Card</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </>
  );

  if (!expensesAllowed) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        You do not have permission to view Accounts &amp; Expenses.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts & Expenses"
        description="Office bills, payroll salary postings, and payables"
        actions={
          canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              New expense
            </Button>
          ) : undefined
        }
      />
      {canPaySalary ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-semibold text-primary">Payroll</p>
                <p className="text-sm text-muted-foreground">Post monthly salary from user payroll as a paid Salary expense, tagged to the staff office.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>Month</Label>
                  <Select value={payrollPeriod} onValueChange={setPayrollPeriod}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollPeriodOptions().map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void payAllUnpaid()} disabled={salaryStaff.every((s) => paidSalaryIds.has(s.id))}>
                  Pay all unpaid
                </Button>
              </div>
            </div>
            {salaryStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff have a salary on Users & Teams yet.</p>
            ) : (
              <div className="erp-table-scroll">
                <table className="erp-data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Office</th>
                      <th>Salary</th>
                      <th>This month</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {salaryStaff.map((person) => {
                      const paid = paidSalaryIds.has(person.id);
                      const row = payroll[person.id];
                      return (
                        <tr key={person.id}>
                          <td className="font-medium">{personName(person)}</td>
                          <td>{officeName(person.office_id) || '—'}</td>
                          <td>{formatMoney(Number(row.salary_amount) || 0, row.salary_currency || 'PKR')}</td>
                          <td>{paid ? <Badge variant="outline" className={statusStyles.paid}>Paid</Badge> : 'Unpaid'}</td>
                          <td className="text-right">
                            <Button size="sm" disabled={paid || payingUser === person.id} onClick={() => void paySalary(person.id)}>
                              {payingUser === person.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay salary'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total expenses', value: stats.total },
          { label: 'Pending', value: stats.pending },
          { label: 'Approved', value: stats.approved },
          { label: 'Total amount', value: stats.totalAmount.toLocaleString() },
        ].map((s) => (
          <Card key={s.label} className="erp-stat-card rounded-md shadow-sm">
            <CardContent className="p-3.5 sm:p-4">
              <p className="erp-stat-label">{s.label}</p>
              <p className="erp-stat-value">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="erp-filter-panel">
        <div className="erp-filter-bar">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, vendor, category..." />
          </div>
          {!lockedOfficeId ? (
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Office" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading expenses...
          </div>
        ) : filtered.length === 0 ? (
          <ErpEmptyState
            icon={Wallet}
            title="No expenses found"
            description="Record an office bill or adjust your filters."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => setSelected(e)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/45">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{e.expense_code}</p>
                    <Badge variant="outline" className={statusStyles[e.status]}>
                      {e.status}
                    </Badge>
                    <AttachmentCountBadge count={attachmentCounts[e.id] || 0} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.category}
                    {officeName(e.office_id) ? ` · ${officeName(e.office_id)}` : ''}
                    {e.vendor ? ` · ${e.vendor}` : ''}
                    {e.payroll_period ? ` · ${e.payroll_period}` : ''}
                    {vehicleLabel(e.vehicle_id) ? ` · ${vehicleLabel(e.vehicle_id)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {e.currency} {e.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.expense_date), 'MMM d, yyyy')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent fullscreen>
          <DialogHeader>
            <DialogTitle>New expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitExpense} className="space-y-4">
            {expenseFormFields}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.category.trim() || !form.amount || !form.office_id}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create expense'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pr-8">
                <SheetTitle>{selected.expense_code}</SheetTitle>
                <SheetDescription>
                  {selected.category}
                  {selected.vendor ? ` · ${selected.vendor}` : ''}
                </SheetDescription>
              </SheetHeader>
              <div className="flex gap-2 pb-2">
                <Button size="sm" variant="outline" onClick={openEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="mt-1 text-sm font-semibold">
                      {selected.currency} {selected.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="mt-1 text-sm">{format(new Date(selected.expense_date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                {officeName(selected.office_id) ? <p className="text-sm text-muted-foreground">Office: {officeName(selected.office_id)}</p> : null}
                {selected.payroll_period ? <p className="text-sm text-muted-foreground">Payroll period: {selected.payroll_period}</p> : null}
                {vehicleLabel(selected.vehicle_id) && <p className="text-sm text-muted-foreground">Vehicle: {vehicleLabel(selected.vehicle_id)}</p>}
                {selected.payment_method && <p className="text-sm text-muted-foreground">Method: {selected.payment_method.replace('_', ' ')}</p>}
                {selected.notes && <p className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">{selected.notes}</p>}
                {selected.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={approveExpense}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={rejectExpense}>
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
                {selected.status === 'approved' && (
                  <Button size="sm" className="w-full" onClick={markPaid}>
                    Mark as paid
                  </Button>
                )}
              </div>
              <RecordAttachments entityType="expenses" entityId={selected.id} onCountChange={(n) => setAttachmentCount(selected.id, n)} />
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent fullscreen>
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            {expenseFormFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.office_id}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete expense?"
        description="This will permanently remove the expense record. This action cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        loading={submitting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
