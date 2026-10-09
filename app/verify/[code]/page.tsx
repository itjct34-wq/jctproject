'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { InvoiceVerifyResult } from '@/lib/types';
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
        const { data, error } = await supabase.rpc('verify_invoice', { p_token: code });
        if (error) {
          setResult({ valid: false, message: error.message });
        } else {
          setResult(data as InvoiceVerifyResult);
        }
      } catch (e) {
        setResult({ valid: false, message: 'Verification service unavailable' });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-600/20 mb-3">
            <ShieldCheck className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-white">Japan Circular Trading</h1>
          <p className="text-sm text-zinc-400 mt-1">Invoice Authenticity Verification</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <p className="text-sm text-zinc-400">Verifying invoice…</p>
            </div>
          )}

          {!loading && result?.valid && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-400">Authentic Invoice</p>
                  <p className="text-xs text-emerald-400/70">This document was issued by Japan Circular Trading</p>
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
                    <div key={label as string} className="flex justify-between border-b border-zinc-800 pb-2">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-zinc-100 font-medium capitalize text-right">{value}</dd>
                    </div>
                  ))}
              </dl>

              {result.verified_at && (
                <p className="text-[10px] text-zinc-600 text-center pt-2">
                  Verified at {new Date(result.verified_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {!loading && result && !result.valid && (
            <div className="flex flex-col items-center py-8 gap-3">
              <XCircle className="w-12 h-12 text-red-500" />
              <p className="font-semibold text-red-400">Invalid or Unknown Invoice</p>
              <p className="text-sm text-zinc-500 text-center">
                {result.message || 'This verification code does not match any issued invoice.'}
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-6">
          © Japan Circular Trading · Nagoya, Japan · info@japancirculartrading.com
        </p>
      </div>
    </div>
  );
}
