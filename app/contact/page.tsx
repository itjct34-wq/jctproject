'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicShell } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const field =
  'h-11 w-full rounded-xl border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)] outline-none focus:ring-2 focus:ring-[var(--jct-vermilion)]/25';

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  destination_country: '',
  destination_port: '',
  vehicle_make: '',
  vehicle_model: '',
  budget_max: '',
  currency: 'USD',
  incoterm: 'FOB',
  message: '',
};

function ContactForm() {
  const searchParams = useSearchParams();
  const stockHint = searchParams.get('stock') || '';
  const [form, setForm] = useState({
    ...emptyForm,
    message: stockHint ? `Interested in stock ${stockHint}.` : '',
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

  useEffect(() => {
    if (!stockHint) return;
    setForm((p) =>
      p.message.includes(stockHint) ? p : { ...p, message: `Interested in stock ${stockHint}.` }
    );
  }, [stockHint]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setCode('');
    const row = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      company_name: null,
      destination_country: form.destination_country || null,
      destination_port: form.destination_port.trim() || null,
      vehicle_make: form.vehicle_make.trim() || null,
      vehicle_model: form.vehicle_model.trim() || null,
      year_from: null,
      year_to: null,
      budget_min: null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      currency: form.currency || 'USD',
      incoterm: form.incoterm || 'FOB',
      quantity: 1,
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
    <section className="jct-home-wrap max-w-xl py-12 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">Inquiry</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-[var(--jct-navy)]">Request a quote</h1>
      <p className="mt-2 text-sm text-[var(--jct-muted)]">
        A few details is enough. We reply with FOB / C&amp;F options from Nagoya.
      </p>

      {code ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-[var(--jct-navy)]">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <h2 className="mt-3 text-xl font-semibold">Thanks — we got it</h2>
          <p className="mt-2 text-sm">
            Reference: <strong className="font-mono">{code}</strong>
          </p>
          <p className="mt-1 text-sm text-[var(--jct-muted)]">We will contact you by email or WhatsApp.</p>
          <Button
            className="jct-btn-primary mt-4 h-auto"
            onClick={() => {
              setCode('');
              setForm({ ...emptyForm, message: '' });
            }}
          >
            Send another
          </Button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="relative mt-8 space-y-5 rounded-2xl border border-[var(--jct-border)] bg-white p-5 shadow-[0_4px_18px_rgba(11,31,51,0.06)] md:p-6"
        >
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label>
              Leave this field empty
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Your name *</Label>
            <Input
              id="full_name"
              required
              minLength={2}
              maxLength={160}
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              className="h-11"
              placeholder="Full name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                required
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="h-11"
                placeholder="you@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp / phone</Label>
              <Input
                id="phone"
                maxLength={40}
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="h-11"
                placeholder="+254…"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="destination_country">Destination country</Label>
              <select
                id="destination_country"
                value={form.destination_country}
                onChange={(e) => set('destination_country', e.target.value)}
                className={field}
              >
                <option value="">Choose country</option>
                {destinations.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination_port">Port (optional)</Label>
              <Input
                id="destination_port"
                maxLength={120}
                value={form.destination_port}
                onChange={(e) => set('destination_port', e.target.value)}
                className="h-11"
                placeholder="e.g. Mombasa"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle_make">Make</Label>
              <Input
                id="vehicle_make"
                maxLength={100}
                value={form.vehicle_make}
                onChange={(e) => set('vehicle_make', e.target.value)}
                className="h-11"
                placeholder="Toyota"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_model">Model</Label>
              <Input
                id="vehicle_model"
                maxLength={100}
                value={form.vehicle_model}
                onChange={(e) => set('vehicle_model', e.target.value)}
                className="h-11"
                placeholder="Prius"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget_max">Max budget (USD)</Label>
              <Input
                id="budget_max"
                type="number"
                min="0"
                value={form.budget_max}
                onChange={(e) => set('budget_max', e.target.value)}
                className="h-11"
                placeholder="15000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incoterm">Trade term</Label>
              <select
                id="incoterm"
                value={form.incoterm}
                onChange={(e) => set('incoterm', e.target.value)}
                className={field}
              >
                <option value="FOB">FOB</option>
                <option value="C&F">C&amp;F</option>
                <option value="CIF">CIF</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">What do you need? *</Label>
            <Textarea
              id="message"
              required
              minLength={5}
              maxLength={8000}
              rows={4}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder="Year, grade, colour, timing…"
            />
          </div>

          <Button type="submit" disabled={busy} className="jct-btn-primary h-11 w-full disabled:opacity-50">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send inquiry
              </>
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-[var(--jct-muted-2)]">
        Official bank details appear only on your invoice.
      </p>
    </section>
  );
}

export default function ContactPage() {
  return (
    <PublicShell>
      <Suspense
        fallback={
          <div className="jct-home-wrap flex min-h-[40vh] items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--jct-muted-2)]" />
          </div>
        }
      >
        <ContactForm />
      </Suspense>
    </PublicShell>
  );
}
