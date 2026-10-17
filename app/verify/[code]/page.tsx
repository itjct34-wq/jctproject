'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
      } catch {
        setResult({ valid: false, message: 'Verification service unavailable' });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <PublicShell>
      <section className="jct-home-wrap flex flex-col items-center py-12 md:py-16">
        {loading && (
          <div className="flex w-full max-w-[760px] flex-col items-center gap-3 rounded-2xl border border-[var(--jct-border)] bg-white py-16 shadow-[0_4px_18px_rgba(11,31,51,0.06)]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--jct-vermilion)]" />
            <p className="text-sm text-[var(--jct-muted)]">Verifying document…</p>
          </div>
        )}

        {!loading && result?.valid && (
          <div className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-white shadow-[0_4px_18px_rgba(11,31,51,0.06)]">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 py-8 text-center text-white md:px-10">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Verification result
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">Authentic document</h1>
            </div>

            <div className="grid gap-8 p-6 md:grid-cols-[1fr_220px] md:p-8">
              <dl className="space-y-3 text-sm">
                {[
                  ['Document type', result.invoice_type || 'Invoice'],
                  ['Invoice no.', result.invoice_code],
                  ['Issued on', result.issue_date],
                  ['Consignee', result.customer_name],
                  [
                    'Amount',
                    result.total != null
                      ? `${result.currency} ${Number(result.total).toLocaleString()}`
                      : null,
                  ],
                  ['Status', result.payment_status],
                  ['Terms', result.incoterms],
                  ['POL', result.port_of_loading],
                  ['POD', result.port_of_discharge],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between gap-4 border-b border-[var(--jct-border)] pb-2"
                    >
                      <dt className="text-[var(--jct-muted-2)]">{label}</dt>
                      <dd className="text-right font-medium capitalize text-[var(--jct-navy)] font-mono text-[13px]">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>

              <aside className="flex flex-col items-center rounded-xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--jct-muted-2)]">
                  Scanned from the QR on the invoice
                </p>
                <div className="mt-3 flex h-28 w-28 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
                  <ShieldCheck className="h-12 w-12 text-emerald-600" aria-hidden />
                </div>
                <div className="relative mt-4 h-16 w-16 overflow-hidden rounded-full">
                  <Image
                    src="/images/company-hanko.png"
                    alt="Company seal"
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                </div>
              </aside>
            </div>

            <div className="flex flex-col items-start justify-between gap-2 border-t border-[var(--jct-border)] bg-[var(--jct-panel)] px-6 py-4 text-sm sm:flex-row sm:items-center md:px-8">
              <p className="text-[var(--jct-muted)]">
                Always confirm the amount and bank details match the verified record.
              </p>
              <Link
                href="/contact"
                className="font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
              >
                Report a problem
              </Link>
            </div>
          </div>
        )}

        {!loading && result && !result.valid && (
          <div className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-white shadow-[0_4px_18px_rgba(11,31,51,0.06)]">
            <div className="bg-gradient-to-br from-[var(--jct-vermilion)] to-[#a82820] px-6 py-8 text-center text-white">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <XCircle className="h-8 w-8" aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                Verification result
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold">Document not found</h1>
            </div>
            <div className="space-y-4 p-8 text-center">
              <p className="text-sm text-[var(--jct-muted)]">
                {result.message || 'This code does not match an issued invoice. Do not pay until you confirm with the exporter.'}
              </p>
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--jct-vermilion)] px-5 text-sm font-semibold text-white"
              >
                Contact us on WhatsApp
              </Link>
            </div>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
