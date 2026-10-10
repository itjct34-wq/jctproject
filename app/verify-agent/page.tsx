'use client';

import { useState } from 'react';
import { PublicShell } from '@/components/public/public-shell';
import { supabase } from '@/lib/supabase/client';
import { BadgeCheck, Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';

type Agent = {
  agent_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  photo_url: string | null;
  is_active: boolean;
  verified_until: string | null;
  representative_type: string | null;
};

const typeLabel: Record<string, string> = {
  sales_agent: 'Sales Agent',
  freelancer: 'Freelance Representative',
  company_representative: 'Company Representative',
};

export default function VerifyAgentPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setNotFound(false);
    setAgent(null);
    const { data } = await supabase
      .from('agent_verifications')
      .select('agent_code, full_name, email, phone, title, photo_url, is_active, verified_until, representative_type')
      .eq('agent_code', c)
      .maybeSingle();
    setLoading(false);
    if (!data || !data.is_active) {
      setNotFound(true);
      return;
    }
    if (data.verified_until && new Date(data.verified_until) < new Date()) {
      setNotFound(true);
      return;
    }
    setAgent(data as Agent);
  };

  return (
    <PublicShell>
      <section className="mx-auto max-w-xl px-4 sm:px-6 py-14 md:py-20">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 text-red-400">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white">Verify company representative</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Sales agents, freelancers and staff receive an automatic ID (e.g. JCT-REP-0001).
            Enter the code before paying. Pay only to official company accounts.
          </p>
        </div>

        <form onSubmit={lookup} className="mt-10 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. JCT-REP-0001"
            className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 uppercase"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>

        {notFound && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-950/40 p-5 flex gap-3">
            <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold text-red-200">Not a verified representative</p>
              <p className="mt-1 text-sm text-red-200/80">
                Invalid, expired or inactive code. Do not transfer money to personal accounts.
              </p>
            </div>
          </div>
        )}

        {agent && (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-6">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <ShieldCheck className="h-5 w-5" /> Verified Japan Circular Trading representative
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-zinc-800 border border-white/10 flex items-center justify-center text-lg font-bold text-white">
                {agent.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  agent.full_name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-white">{agent.full_name}</p>
                <p className="text-sm text-zinc-400">
                  {agent.title || typeLabel[agent.representative_type || ''] || 'Representative'}
                </p>
                <p className="mt-1 font-mono text-xs text-emerald-300">{agent.agent_code}</p>
                {agent.representative_type && (
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
                    {typeLabel[agent.representative_type] || agent.representative_type}
                  </p>
                )}
              </div>
            </div>
            {(agent.email || agent.phone) && (
              <div className="mt-4 text-sm text-zinc-400 space-y-1 border-t border-white/10 pt-4">
                {agent.email && <p>Email: {agent.email}</p>}
                {agent.phone && <p>Phone / WhatsApp: {agent.phone}</p>}
                {agent.verified_until && (
                  <p>Valid until: {new Date(agent.verified_until).toLocaleDateString()}</p>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-500">
              Always pay only to Japan Circular Trading company bank accounts — never to a personal account.
            </p>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
