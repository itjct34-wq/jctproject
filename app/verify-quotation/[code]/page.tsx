'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PublicShell } from '@/components/public/public-shell';
import { BadgeCheck, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';

type Verification = {
  valid: boolean;
  message?: string;
  quotation_code?: string;
  price_type?: string;
  created_at?: string;
  currency?: string;
  total?: number;
  status?: string;
  valid_until?: string | null;
  company_name?: string;
  verified_at?: string;
};

export default function VerifyQuotationPage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';
  const [result, setResult] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setResult({ valid: false, message: 'Missing verification code' });
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('verify_quotation', { p_token: code });
        if (error) setResult({ valid: false, message: 'Verification service unavailable' });
        else setResult(data as Verification);
      } catch {
        setResult({ valid: false, message: 'Verification service unavailable' });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <PublicShell>
      <section className="jct-home-wrap max-w-xl py-14 md:py-20">
        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--jct-vermilion)]/10">
            <ShieldCheck className="h-7 w-7 text-[var(--jct-vermilion)]" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-[var(--jct-navy)]">Quotation authenticity verification</h1>
          <p className="mt-2 text-sm text-[var(--jct-muted)]">Nagoya, Japan · no login required</p>
        </div>
        <div className="rounded-2xl border border-[var(--jct-border)] bg-white p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--jct-vermilion)]" />
              <p className="text-sm text-[var(--jct-muted)]">Verifying quotation…</p>
            </div>
          )}
          {!loading && result?.valid && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <BadgeCheck className="h-8 w-8 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-800">Authentic quotation</p>
                  <p className="text-xs text-emerald-800/80">This quotation number matches our issued records.</p>
                </div>
              </div>
              <dl className="space-y-3 text-sm">
                {[
                  ['Quotation No.', result.quotation_code],
                  ['Price terms', result.price_type],
                  ['Issue date', result.created_at ? new Date(result.created_at).toLocaleDateString() : null],
                  ['Total', result.total != null ? `${result.currency} ${Number(result.total).toLocaleString()}` : null],
                  ['Status', result.status],
                  ['Valid until', result.valid_until ? new Date(result.valid_until).toLocaleDateString() : null],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-4 border-b border-[var(--jct-border)] pb-2">
                      <dt className="text-[var(--jct-muted-2)]">{label}</dt>
                      <dd className="text-right font-medium capitalize text-[var(--jct-navy)]">{value}</dd>
                    </div>
                  ))}
              </dl>
              <p className="text-xs leading-relaxed text-[var(--jct-muted-2)]">
                This confirms the quotation record only. Final vehicle availability and shipping costs remain subject to written confirmation.
              </p>
            </div>
          )}
          {!loading && result && !result.valid && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-[var(--jct-vermilion)]" />
              <p className="font-semibold text-[var(--jct-navy)]">Invalid or unknown quotation</p>
              <p className="text-sm text-[var(--jct-muted)]">{result.message || 'This verification code does not match an active quotation.'}</p>
              <ShieldAlert className="h-5 w-5 text-[var(--jct-muted-2)]" />
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
