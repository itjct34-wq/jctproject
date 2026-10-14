'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DESTINATION_PORTS } from '@/lib/public/catalog';

const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: '5000', label: 'Up to $5,000' },
  { value: '10000', label: 'Up to $10,000' },
  { value: '15000', label: 'Up to $15,000' },
  { value: '20000', label: 'Up to $20,000' },
  { value: '30000', label: 'Up to $30,000' },
];

type Props = {
  makes: string[];
  modelsByMake: Record<string, string[]>;
};

export function HeroSearch({ makes, modelsByMake }: Props) {
  const router = useRouter();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [port, setPort] = useState('');

  const models = useMemo(() => (make ? modelsByMake[make] || [] : []), [make, modelsByMake]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set('make', make);
    if (model) params.set('q', model);
    const qs = params.toString();
    router.push(qs ? `/inventory?${qs}` : '/inventory');
  };

  const field =
    'mt-1.5 h-11 w-full rounded-lg border border-[var(--jct-border)] bg-white px-3 text-sm text-[var(--jct-navy)] outline-none focus-visible:border-[var(--jct-vermilion)] focus-visible:ring-2 focus-visible:ring-[var(--jct-vermilion)]/20 disabled:bg-[var(--jct-panel)] disabled:text-[var(--jct-muted-2)]';

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--jct-border)] bg-white p-4 shadow-[0_12px_40px_rgba(11,31,51,0.12)] sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-medium text-[var(--jct-muted)]">
          Make
          <select
            className={field}
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('');
            }}
          >
            <option value="">Any make</option>
            {makes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--jct-muted)]">
          Model
          <select className={field} value={model} disabled={!make} onChange={(e) => setModel(e.target.value)}>
            <option value="">{make ? 'Any model' : 'Choose make first'}</option>
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--jct-muted)]">
          Max budget (FOB)
          <select className={field} value={budget} onChange={(e) => setBudget(e.target.value)}>
            {BUDGETS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[var(--jct-muted)]">
          Destination port
          <select className={field} value={port} onChange={(e) => setPort(e.target.value)}>
            <option value="">Choose port</option>
            {DESTINATION_PORTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--jct-vermilion)] px-4 text-sm font-semibold text-white hover:bg-[#c23024] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-navy)]"
          >
            Search cars
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--jct-muted-2)]">
        Can&apos;t find it?{' '}
        <Link href="/contact" className="font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline">
          Tell us the model, year and budget
        </Link>{' '}
        and we search the auctions for you.
      </p>
    </form>
  );
}
