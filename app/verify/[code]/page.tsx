'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { InvoiceVerifyResult } from '@/lib/types';
import { PublicShell } from '@/components/public/public-shell';
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function VerifyInvoicePage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';
  const [result, setResult] = useState<InvoiceVerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setResult({ valid: false, message: 'Missing verification code' });
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/public/verify-invoice?token=${encodeURIComponent(code)}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as InvoiceVerifyResult;
        setResult(data);
      } catch (e) {
        setResult({ valid: false, message: 'Verification service unavailable' });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <PublicShell>
      <section className="jct-home-wrap flex max-w-md flex-col items-center py-14 md:py-20">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--jct-vermilion)]/10">
            <ShieldCheck className="h-7 w-7 text-[var(--jct-vermilion)]" />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--jct-navy)]">Invoice authenticity check</h1>
          <p className="mt-1 text-sm text-[var(--jct-muted)]">No login required</p>
        </div>

        <div className="w-full rounded-2xl border border-[var(--jct-border)] bg-white p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--jct-vermilion)]" />
              <p className="text-sm text-[var(--jct-muted)]">Verifying invoice…</p>
            </div>
          )}

          {!loading && result?.valid && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-800">Authentic Invoice</p>
                  <p className="text-xs text-emerald-800/70">This document matches our issued records</p>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                {[
                  ['Invoice No.', result.invoice_code],
                  ['Type', result.invoice_type],
                  ['Issue Date', result.issue_date],
                  ['Buyer', result.customer_name],
                  ['Total', result.total != null ? `${result.currency} ${Number(result.total).toLocaleString()}` : null],
                  ['Payment Status', result.payment_status],
                  ['Incoterms', result.incoterms],
                  ['Shipment', result.shipment_type],
                  ['Mode', result.container_mode],
                  ['POL', result.port_of_loading],
                  ['POD', result.port_of_discharge],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label as string} className="flex justify-between border-b border-[var(--jct-border)] pb-2">
                      <dt className="text-[var(--jct-muted-2)]">{label}</dt>
                      <dd className="text-right font-medium capitalize text-[var(--jct-navy)]">{value}</dd>
                    </div>
                  ))}
              </dl>

              {result.verified_at && (
                <p className="pt-2 text-center text-[10px] text-[var(--jct-muted-2)]">
                  Verified at {new Date(result.verified_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {!loading && result && !result.valid && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-[var(--jct-vermilion)]" />
              <p className="font-semibold text-[var(--jct-navy)]">Invalid or unknown invoice</p>
              <p className="text-center text-sm text-[var(--jct-muted)]">
                {result.message || 'This verification code does not match any issued invoice.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
