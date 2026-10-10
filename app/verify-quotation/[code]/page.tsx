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
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 md:py-20">
        <div className="mb-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600/20">
            <ShieldCheck className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Quotation authenticity verification</h1>
          <p className="mt-2 text-sm text-zinc-400">Japan Circular Trading · Nagoya, Japan</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          {loading && <div className="flex flex-col items-center gap-3 py-10"><Loader2 className="h-8 w-8 animate-spin text-red-500" /><p className="text-sm text-zinc-400">Verifying quotation…</p></div>}
          {!loading && result?.valid && <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <BadgeCheck className="h-8 w-8 shrink-0 text-emerald-400" />
              <div><p className="font-semibold text-emerald-400">Authentic quotation</p><p className="text-xs text-emerald-300/80">This quotation number was issued by Japan Circular Trading.</p></div>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ['Quotation No.', result.quotation_code],
                ['Price terms', result.price_type],
                ['Issue date', result.created_at ? new Date(result.created_at).toLocaleDateString() : null],
                ['Total', result.total != null ? `${result.currency} ${Number(result.total).toLocaleString()}` : null],
                ['Status', result.status],
                ['Valid until', result.valid_until ? new Date(result.valid_until).toLocaleDateString() : null],
              ].filter(([, value]) => value).map(([label, value]) => <div key={label as string} className="flex justify-between gap-4 border-b border-zinc-800 pb-2"><dt className="text-zinc-500">{label}</dt><dd className="text-right font-medium capitalize text-zinc-100">{value}</dd></div>)}
            </dl>
            <p className="text-xs leading-relaxed text-zinc-500">This confirms the quotation record only. Final vehicle availability and shipping costs remain subject to written confirmation.</p>
          </div>}
          {!loading && result && !result.valid && <div className="flex flex-col items-center gap-3 py-8 text-center"><XCircle className="h-12 w-12 text-red-500" /><p className="font-semibold text-red-300">Invalid or unknown quotation</p><p className="text-sm text-zinc-400">{result.message || 'This verification code does not match an active quotation.'}</p><ShieldAlert className="h-5 w-5 text-zinc-600" /></div>}
        </div>
      </section>
    </PublicShell>
  );
}
