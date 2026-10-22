'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { DESTINATION_PORTS } from '@/lib/public/catalog';
import { cn } from '@/lib/utils';

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
  const baseId = useId();
  const [keyword, setKeyword] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [port, setPort] = useState('');

  const models = useMemo(() => {
    if (!make) return [];
    return modelsByMake[make] || [];
  }, [make, modelsByMake]);

  const modelEnabled = Boolean(make);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const term = keyword.trim();
    if (make) params.set('make', make);
    if (model) params.set('model', model);
    if (term) params.set('q', term);
    if (budget) params.set('budget_max', budget);
    if (port) params.set('port', port);
    const qs = params.toString();
    router.push(qs ? `/inventory?${qs}` : '/inventory');
  };

  const field =
    'h-11 w-full appearance-none rounded-[var(--radius)] border border-[var(--jct-border)] bg-white px-3 pr-9 text-sm text-[var(--jct-navy)] outline-none transition-colors focus-visible:border-[var(--jct-vermilion)] focus-visible:ring-2 focus-visible:ring-[var(--jct-vermilion)]/20';

  const fieldDisabled =
    'h-11 w-full appearance-none rounded-[var(--radius)] border border-[var(--jct-border)]/70 bg-[var(--jct-panel)] px-3 pr-9 text-sm text-[var(--jct-muted-2)] outline-none cursor-not-allowed';

  const labelClass = 'block text-xs font-semibold text-[var(--jct-muted)]';

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius)] border-2 border-[var(--jct-canopy)] bg-white p-4 shadow-[0_12px_40px_rgba(20,24,28,0.14)] sm:p-5"
    >
      <div>
        <label htmlFor={`${baseId}-keyword`} className={labelClass}>
          Search make, model or keyword
        </label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--jct-muted-2)]" aria-hidden />
          <input
            id={`${baseId}-keyword`}
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. Toyota Prius, hybrid, 2020…"
            className="h-11 w-full rounded-[var(--radius)] border border-[var(--jct-border)] bg-white py-0 pl-10 pr-3 text-sm text-[var(--jct-navy)] outline-none focus-visible:border-[var(--jct-vermilion)] focus-visible:ring-2 focus-visible:ring-[var(--jct-vermilion)]/20"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${baseId}-make`} className={labelClass}>
            Make
          </label>
          <div className="relative mt-1.5">
            <select
              id={`${baseId}-make`}
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
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--jct-muted-2)]"
              aria-hidden
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-model`} className={labelClass}>
            Model
          </label>
          <div className="relative mt-1.5">
            <select
              id={`${baseId}-model`}
              className={cn(modelEnabled ? field : fieldDisabled)}
              value={model}
              disabled={!modelEnabled}
              aria-disabled={!modelEnabled}
              aria-describedby={!modelEnabled ? `${baseId}-model-hint` : undefined}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">{modelEnabled ? (models.length ? 'Any model' : 'No models listed') : 'Choose make first'}</option>
              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              className={cn(
                'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2',
                modelEnabled ? 'text-[var(--jct-muted-2)]' : 'text-[var(--jct-muted-2)]/60'
              )}
              aria-hidden
            />
          </div>
          {!modelEnabled ? (
            <p id={`${baseId}-model-hint`} className="mt-1 text-[11px] text-[var(--jct-muted-2)]">
              Select a make to load models
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${baseId}-budget`} className={labelClass}>
            Max budget (FOB)
          </label>
          <div className="relative mt-1.5">
            <select
              id={`${baseId}-budget`}
              className={field}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              {BUDGETS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--jct-muted-2)]"
              aria-hidden
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-port`} className={labelClass}>
            Destination port
          </label>
          <div className="relative mt-1.5">
            <select
              id={`${baseId}-port`}
              className={field}
              value={port}
              onChange={(e) => setPort(e.target.value)}
            >
              <option value="">Choose port</option>
              {DESTINATION_PORTS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--jct-muted-2)]"
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          className="jct-btn-primary h-11 w-full px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jct-navy)] sm:w-auto sm:min-w-[160px]"
        >
          Search cars
        </button>
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
