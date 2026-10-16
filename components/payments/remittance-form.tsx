'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencySelect } from '@/components/ui/currency-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/payments/searchable-select';
import { RequiredMark } from '@/components/payments/remittance-crumb';
import { RecordAttachments, uploadRecordAttachment } from '@/components/shared/record-attachments';
import { supabase } from '@/lib/supabase/client';
import type { Customer, Office, Payment, Shift } from '@/lib/types';
import { todayIsoDate } from '@/lib/remittance';
import { toast } from 'sonner';

type Staff = { id: string; full_name: string | null; display_name: string | null };

const emptyForm = {
  customer_id: '',
  office_id: '',
  shift_id: '',
  currency: '',
  remitter_name: '',
  bank_name: '',
  bank_address: '',
  bank_phone: '',
  exchange_rate: '',
  instructed_amount: '',
  remit_amount: '',
  remit_date: '',
  received_date: '',
  notes: '',
};

function Field({
  label,
  ja,
  required,
  children,
}: {
  label: string;
  ja: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px] font-medium leading-tight">
        {label} <span className="text-muted-foreground">· {ja}</span>
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
    </div>
  );
}

function moneyNum(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  payment?: Payment;
  /** Create/edit as Unknown TT (no customer required). */
  unknown?: boolean;
};

export function RemittanceForm({ payment, unknown = false }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const isEdit = Boolean(payment);
  const isUnknownMode = unknown || Boolean(payment?.is_unknown && !payment?.customer_id);
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadLookups = useCallback(async () => {
    setLoading(true);
    const [cRes, oRes, sRes, pRes] = await Promise.all([
      supabase.from('customers').select('id, customer_code, full_name, phone, assigned_to, created_by').order('full_name').limit(500),
      supabase.from('offices').select('*').eq('is_active', true).order('name'),
      supabase.from('shifts').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, full_name, display_name').eq('is_active', true).limit(250),
    ]);
    if (cRes.error) toast.error(`Unable to load customers: ${cRes.error.message}`);
    setCustomers((cRes.data || []) as Customer[]);
    setOffices((oRes.data || []) as Office[]);
    setShifts((sRes.data || []) as Shift[]);
    setStaff((pRes.data || []) as Staff[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (payment) {
      setForm({
        customer_id: payment.customer_id || '',
        office_id: payment.office_id || '',
        shift_id: payment.shift_id || '',
        currency: payment.currency || '',
        remitter_name: payment.remitter_name || '',
        bank_name: payment.bank_name || '',
        bank_address: payment.bank_address || '',
        bank_phone: payment.bank_phone || '',
        exchange_rate: String(payment.exchange_rate ?? ''),
        instructed_amount: String(payment.instructed_amount ?? payment.amount ?? ''),
        remit_amount: String(payment.remit_amount ?? payment.amount ?? ''),
        remit_date: payment.remit_date || payment.payment_date || '',
        received_date: payment.received_date || '',
        notes: payment.notes || '',
      });
      return;
    }
    setForm({
      ...emptyForm,
      office_id: profile?.office_id || '',
      shift_id: profile?.shift_id || '',
      remit_date: todayIsoDate(),
      received_date: todayIsoDate(),
    });
  }, [payment, profile?.office_id, profile?.shift_id]);

  const officeShifts = useMemo(
    () => shifts.filter((s) => !form.office_id || s.office_id === form.office_id),
    [shifts, form.office_id],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.full_name} (${c.customer_code})`,
        keywords: `${c.phone || ''} ${c.customer_code}`,
      })),
    [customers],
  );

  const selectedCustomer = customers.find((c) => c.id === form.customer_id);
  const taggedName = useMemo(() => {
    const id = selectedCustomer?.assigned_to;
    if (!id) return '';
    const row = staff.find((s) => s.id === id);
    return row?.full_name || row?.display_name || '';
  }, [selectedCustomer, staff]);

  const instructed = moneyNum(form.instructed_amount);
  const remit = moneyNum(form.remit_amount);
  const bankCharges = Math.max(0, Math.round((instructed - remit) * 100) / 100);

  const reset = () => {
    if (payment) {
      setForm({
        customer_id: payment.customer_id || '',
        office_id: payment.office_id || '',
        shift_id: payment.shift_id || '',
        currency: payment.currency || '',
        remitter_name: payment.remitter_name || '',
        bank_name: payment.bank_name || '',
        bank_address: payment.bank_address || '',
        bank_phone: payment.bank_phone || '',
        exchange_rate: String(payment.exchange_rate ?? ''),
        instructed_amount: String(payment.instructed_amount ?? payment.amount ?? ''),
        remit_amount: String(payment.remit_amount ?? payment.amount ?? ''),
        remit_date: payment.remit_date || payment.payment_date || '',
        received_date: payment.received_date || '',
        notes: payment.notes || '',
      });
      return;
    }
    setForm({
      ...emptyForm,
      office_id: profile?.office_id || '',
      shift_id: profile?.shift_id || '',
      remit_date: todayIsoDate(),
      received_date: todayIsoDate(),
    });
    setFiles([]);
  };

  const payload = () => {
    const rate = moneyNum(form.exchange_rate) || 1;
    const asUnknown = isUnknownMode && !form.customer_id;
    return {
      customer_id: asUnknown ? null : form.customer_id,
      sales_agent_id: asUnknown ? null : undefined,
      is_unknown: asUnknown,
      office_id: form.office_id || null,
      shift_id: form.shift_id || null,
      remitter_name: form.remitter_name.trim(),
      bank_name: form.bank_name.trim(),
      bank_address: form.bank_address.trim() || null,
      bank_phone: form.bank_phone.trim() || null,
      currency: form.currency,
      exchange_rate: rate,
      instructed_amount: instructed,
      remit_amount: remit,
      amount: remit,
      amount_jpy: remit * rate,
      bank_charges: bankCharges,
      remit_date: form.remit_date,
      payment_date: form.remit_date || todayIsoDate(),
      received_date: form.received_date || null,
      notes: form.notes.trim() || null,
      payment_method: 'bank_transfer' as const,
      status: form.received_date ? 'received' : 'pending',
    };
  };

  const validate = () => {
    if (!isUnknownMode && !form.customer_id) return 'Customer is required';
    if (!form.office_id) return 'Office is required';
    if (!form.currency) return 'Currency is required';
    if (!form.remitter_name.trim()) return 'Remitter is required';
    if (!form.bank_name.trim()) return 'Bank is required';
    if (!form.exchange_rate || moneyNum(form.exchange_rate) <= 0) return 'Exchange rate is required';
    if (instructed <= 0) return 'Instructed amount is required';
    if (remit <= 0) return 'Remit amount is required';
    if (!form.remit_date) return 'Remit date is required';
    if (!form.received_date) return 'Remittance received date is required';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    const body = payload();
    // Avoid wiping sales_agent_id on normal edits when key is undefined.
    const updateBody = Object.fromEntries(
      Object.entries({ ...body, updated_at: new Date().toISOString() }).filter(([, v]) => v !== undefined),
    );
    const listHref = isUnknownMode ? '/payments?tab=unknown' : '/payments';
    if (isEdit && payment) {
      const { error } = await supabase.from('payments').update(updateBody).eq('id', payment.id);
      setSubmitting(false);
      if (error) {
        toast.error(`Could not update remittance: ${error.message}`);
        return;
      }
      toast.success(isUnknownMode ? 'Unknown TT updated' : 'Remittance updated');
      router.push(listHref);
      router.refresh();
      return;
    }
    const insertBody = Object.fromEntries(
      Object.entries({ ...body, created_by: profile.id }).filter(([, v]) => v !== undefined),
    );
    const { data: created, error } = await supabase
      .from('payments')
      .insert(insertBody)
      .select('id')
      .maybeSingle();
    if (error || !created) {
      setSubmitting(false);
      toast.error(`Could not create remittance: ${error?.message || 'unknown error'}`);
      return;
    }
    for (const file of files) {
      const ok = await uploadRecordAttachment('payments', created.id, file, profile.id);
      if (!ok) toast.error(`Remittance saved but ${file.name} did not upload`);
    }
    setSubmitting(false);
    toast.success(isUnknownMode ? 'Unknown TT saved to inbox' : 'Remittance created');
    router.push(listHref);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading form...
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="erp-workform space-y-3">
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {isUnknownMode ? (
          <Field label="Customer" ja="お客様">
            <Input value="Unknown — tag later" readOnly className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Held in Unknown TT until customer and sales agent are tagged.
            </p>
          </Field>
        ) : (
          <Field label="Customer" ja="お客様" required>
            <SearchableSelect
              value={form.customer_id}
              onChange={(customer_id) => setForm({ ...form, customer_id })}
              options={customerOptions}
              placeholder="Search Customer"
              searchPlaceholder="Search customer"
            />
            {taggedName ? <p className="text-xs text-muted-foreground">Tagged With: {taggedName}</p> : null}
          </Field>
        )}
        <Field label="Office" ja="オフィス" required>
          <Select
            value={form.office_id}
            onValueChange={(office_id) => setForm({ ...form, office_id, shift_id: '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Office" />
            </SelectTrigger>
            <SelectContent>
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Shift Type" ja="シフト">
          <Select
            value={form.shift_id || '__none'}
            onValueChange={(v) => setForm({ ...form, shift_id: v === '__none' ? '' : v })}
            disabled={!form.office_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {officeShifts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Currency" ja="通貨" required>
          <CurrencySelect
            value={form.currency}
            onValueChange={(currency) => setForm({ ...form, currency })}
            placeholder="Select an option"
          />
        </Field>
        <Field label="Remitter" ja="送金者" required>
          <Input value={form.remitter_name} onChange={(e) => setForm({ ...form, remitter_name: e.target.value })} />
        </Field>
        <Field label="Bank" ja="銀行" required>
          <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
        </Field>
        <Field label="Bank Address" ja="銀行住所">
          <Input value={form.bank_address} onChange={(e) => setForm({ ...form, bank_address: e.target.value })} />
        </Field>
        <Field label="Bank Phone" ja="銀行電話">
          <Input value={form.bank_phone} onChange={(e) => setForm({ ...form, bank_phone: e.target.value })} />
        </Field>
        <Field label="Exchange Rate" ja="為替レート" required>
          <Input
            type="number"
            step="0.0001"
            value={form.exchange_rate}
            onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
          />
        </Field>
        <Field label="Instructed Amount" ja="指示金額" required>
          <Input
            type="number"
            step="0.01"
            value={form.instructed_amount}
            onChange={(e) => setForm({ ...form, instructed_amount: e.target.value })}
          />
        </Field>
        <Field label="Remit Amount" ja="送金額" required>
          <Input
            type="number"
            step="0.01"
            value={form.remit_amount}
            onChange={(e) => setForm({ ...form, remit_amount: e.target.value })}
          />
        </Field>
        <Field label="Bank Charges" ja="銀行手数料">
          <Input value={bankCharges ? String(bankCharges) : ''} readOnly className="bg-muted" />
        </Field>
        <Field label="Remit Date" ja="送金日" required>
          <Input type="date" value={form.remit_date} onChange={(e) => setForm({ ...form, remit_date: e.target.value })} />
        </Field>
        <Field label="Remittance Received Date" ja="送金受領日" required>
          <Input
            type="date"
            value={form.received_date}
            onChange={(e) => setForm({ ...form, received_date: e.target.value })}
          />
        </Field>
        <Field label="Remarks" ja="備考">
          <Textarea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <Field label="Documents" ja="書類">
          {isEdit && payment ? (
            <RecordAttachments entityType="payments" entityId={payment.id} allowUpload />
          ) : (
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={reset}>
          Reset
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            'Save'
          ) : isUnknownMode ? (
            'Save Unknown TT'
          ) : (
            'Create'
          )}
        </Button>
      </div>
    </form>
  );
}
