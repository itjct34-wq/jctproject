'use client';

import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/public/public-shell';
import { CountryFlag } from '@/components/public/country-flag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencySelect } from '@/components/ui/currency-select';
import { destinationNames } from '@/lib/public/countries';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

const defaults = destinationNames();

function configList(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(o[k])) return (o[k] as unknown[]).filter((v): v is string => typeof v === 'string');
  }
  return [];
}

const field = 'h-11 w-full rounded-md border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)]';

export default function ContactPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company_name: '', destination_country: '', destination_port: '',
    vehicle_make: '', vehicle_model: '', year_from: '', year_to: '', budget_min: '', budget_max: '',
    currency: 'USD', incoterm: 'FOB', quantity: '1', message: '',
  });
  const [destinations, setDestinations] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const next = configList(d?.freight_destinations, ['countries', 'values', 'options']);
        if (next.length) setDestinations(next);
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setCode('');
    const row = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      company_name: form.company_name.trim() || null,
      destination_country: form.destination_country || null,
      destination_port: form.destination_port.trim() || null,
      vehicle_make: form.vehicle_make.trim() || null,
      vehicle_model: form.vehicle_model.trim() || null,
      year_from: form.year_from ? Number(form.year_from) : null,
      year_to: form.year_to ? Number(form.year_to) : null,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      currency: form.currency,
      incoterm: form.incoterm,
      quantity: Number(form.quantity) || 1,
      message: form.message.trim(),
      website_url: honeypot,
    };
    const response = await fetch('/api/public/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(result.error || 'Could not submit inquiry. Please try again.');
      return;
    }
    setCode(result.inquiry_code);
    toast.success('Inquiry received.');
  };

  return (
    <PublicShell>
      <section className="jct-home-wrap max-w-4xl py-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">Sales inquiry</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">Tell us what you want to import</h1>
        <p className="mt-3 text-sm text-[var(--jct-muted)]">
          Submit your requirements once. Our team can track your request, assign an owner, follow up and prepare a quotation.
        </p>

        {code ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-[var(--jct-navy)]">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <h2 className="mt-3 text-xl font-semibold">Inquiry received</h2>
            <p className="mt-2 text-sm">Reference: <strong className="font-mono">{code}</strong></p>
            <Button
              className="mt-4 bg-[var(--jct-vermilion)] hover:bg-[#c23024]"
              onClick={() => {
                setCode('');
                setForm({
                  full_name: '', email: '', phone: '', company_name: '', destination_country: '', destination_port: '',
                  vehicle_make: '', vehicle_model: '', year_from: '', year_to: '', budget_min: '', budget_max: '',
                  currency: 'USD', incoterm: 'FOB', quantity: '1', message: '',
                });
              }}
            >
              Submit another inquiry
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="relative mt-8 space-y-6 rounded-2xl border border-[var(--jct-border)] bg-white p-5 md:p-7">
            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
            </div>
            <h2 className="font-semibold text-[var(--jct-navy)]">Contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Full name *</Label><Input required minLength={2} maxLength={160} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input required type="email" maxLength={254} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone / WhatsApp</Label><Input maxLength={40} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="space-y-2"><Label>Company</Label><Input maxLength={200} value={form.company_name} onChange={(e) => set('company_name', e.target.value)} /></div>
            </div>
            <h2 className="font-semibold text-[var(--jct-navy)]">Vehicle and destination</h2>
            <div className="flex flex-wrap gap-2">
              {destinations.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('destination_country', c)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm ${
                    form.destination_country === c
                      ? 'border-[var(--jct-navy)] bg-[var(--jct-panel)] font-medium'
                      : 'border-[var(--jct-border)] bg-white'
                  }`}
                >
                  <CountryFlag country={c} size="sm" />
                  {c}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Destination country</Label>
                <select value={form.destination_country} onChange={(e) => set('destination_country', e.target.value)} className={field}>
                  <option value="">Choose country</option>
                  {destinations.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Destination port</Label><Input maxLength={120} value={form.destination_port} onChange={(e) => set('destination_port', e.target.value)} /></div>
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" max="1000" required value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
              <div className="space-y-2"><Label>Make</Label><Input maxLength={100} value={form.vehicle_make} onChange={(e) => set('vehicle_make', e.target.value)} /></div>
              <div className="space-y-2"><Label>Model</Label><Input maxLength={100} value={form.vehicle_model} onChange={(e) => set('vehicle_model', e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Trade term</Label>
                <select value={form.incoterm} onChange={(e) => set('incoterm', e.target.value)} className={field}>
                  <option>FOB</option><option>CFR</option><option>CIF</option><option>EXW</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Year from</Label><Input type="number" min="1950" max="2100" value={form.year_from} onChange={(e) => set('year_from', e.target.value)} /></div>
              <div className="space-y-2"><Label>Year to</Label><Input type="number" min="1950" max="2100" value={form.year_to} onChange={(e) => set('year_to', e.target.value)} /></div>
            </div>
            <h2 className="font-semibold text-[var(--jct-navy)]">Budget</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Currency</Label><CurrencySelect value={form.currency} onValueChange={(v) => set('currency', v)} /></div>
              <div className="space-y-2"><Label>Budget minimum</Label><Input type="number" min="0" value={form.budget_min} onChange={(e) => set('budget_min', e.target.value)} /></div>
              <div className="space-y-2"><Label>Budget maximum</Label><Input type="number" min="0" value={form.budget_max} onChange={(e) => set('budget_max', e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Requirements *</Label>
              <Textarea required minLength={5} maxLength={8000} rows={5} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Models, specifications, target budget, delivery timing…" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-[var(--jct-vermilion)] hover:bg-[#c23024] sm:w-auto">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <><Send className="mr-2 h-4 w-4" />Submit inquiry</>}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-[var(--jct-muted-2)]">
          Prefer to speak directly? <a href="tel:+817022416356" className="text-[var(--jct-vermilion)]">+81 70-2241-6356</a>
        </p>
      </section>
    </PublicShell>
  );
}
