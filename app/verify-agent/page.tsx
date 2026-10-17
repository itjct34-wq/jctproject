'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PublicShell } from '@/components/public/public-shell';
import { BadgeCheck, Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';

type Agent = {
  agent_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  photo_url: string | null;
  representative_type: string | null;
  verified_until: string | null;
};

const labels: Record<string, string> = {
  sales_agent: 'Sales Agent',
  freelancer: 'Freelance Representative',
  company_representative: 'Company Representative',
};

const field =
  'h-11 w-full rounded-xl border border-[var(--jct-border)] bg-white px-4 text-sm text-[var(--jct-navy)] placeholder:text-[var(--jct-muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--jct-vermilion)]/30';

export default function VerifyAgentPage() {
  const [agentCode, setAgentCode] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState('');

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAgent(null);
    setError('');
    try {
      const res = await fetch('/api/public/verify-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_code: agentCode, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.message || 'Invalid or expired code.');
        return;
      }
      setAgent(data.agent as Agent);
    } catch {
      setError('Verification service unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell>
      <section className="jct-home-wrap max-w-xl py-14 md:py-20">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--jct-vermilion)]/10 text-[var(--jct-vermilion)]">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold text-[var(--jct-navy)]">Verify company representative</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--jct-muted)]">
            Ask the representative to show their current six-digit security code in the JCT system. Codes rotate every 30 seconds and expire automatically. A representative ID alone is not proof of identity.
          </p>
        </div>
        <form onSubmit={lookup} className="mt-8 space-y-3 rounded-2xl border border-[var(--jct-border)] bg-white p-5">
          <div className="space-y-2">
            <label className="text-sm text-[var(--jct-navy)]">Representative ID</label>
            <input
              required
              minLength={3}
              maxLength={40}
              autoCapitalize="characters"
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value.toUpperCase())}
              placeholder="JCT-AGT-…"
              className={field}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[var(--jct-navy)]">Current 6-digit code</label>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-12 w-full rounded-xl border border-[var(--jct-border)] bg-white px-4 font-mono text-xl tracking-[0.4em] text-[var(--jct-navy)] placeholder:text-[var(--jct-muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--jct-vermilion)]/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading || agentCode.length < 3 || code.length !== 6}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--jct-vermilion)] px-5 text-sm font-semibold text-white hover:bg-[#c23024] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify current code
          </button>
        </form>
        {error && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <ShieldAlert className="h-6 w-6 shrink-0 text-[var(--jct-vermilion)]" />
            <div>
              <p className="font-semibold text-[var(--jct-navy)]">Verification failed</p>
              <p className="mt-1 text-sm text-[var(--jct-muted)]">{error}</p>
            </div>
          </div>
        )}
        {agent && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-5 w-5" />Live code verified
            </div>
            <p className="mt-1 text-xs text-emerald-800/80">
              Code was valid at {new Date().toLocaleTimeString()} (verification expires with the 30-second time window).
            </p>
            <div className="mt-5 flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[var(--jct-border)] bg-white text-lg font-bold text-[var(--jct-navy)]">
                {agent.photo_url ? (
                  <Image src={agent.photo_url} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  agent.full_name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--jct-navy)]">{agent.full_name}</p>
                <p className="text-sm text-[var(--jct-muted)]">{agent.title || labels[agent.representative_type || ''] || 'Representative'}</p>
                <p className="mt-1 font-mono text-xs text-emerald-700">{agent.agent_code}</p>
              </div>
            </div>
            {(agent.email || agent.phone) && (
              <div className="mt-4 space-y-1 border-t border-emerald-200 pt-4 text-sm text-[var(--jct-muted)]">
                {agent.email && <p>Email: {agent.email}</p>}
                {agent.phone && <p>Phone: {agent.phone}</p>}
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-[var(--jct-muted-2)]">
              A successful check confirms this representative profile was active and the rotating code was valid at verification time. Always pay only to official company accounts.
            </p>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-[var(--jct-muted-2)]">
          If the code has expired, ask the representative to refresh their current code and try again.
        </p>
      </section>
    </PublicShell>
  );
}
