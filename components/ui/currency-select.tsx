'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from '@/lib/utils/currencies';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function CurrencySelect({ value, onValueChange, placeholder = 'Select currency', className, disabled }: Props) {
  const [currencies, setCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
  useEffect(() => {
    let active = true;
    fetch('/api/public/config', { cache: 'no-store' })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!active || !Array.isArray(data?.currencies)) return;
        const next = data.currencies.filter((code: unknown): code is string => typeof code === 'string' && /^[A-Z]{3}$/.test(code));
        if (next.length) setCurrencies(Array.from(new Set(next)));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const options = currencies.includes(value) || !value ? currencies : [value, ...currencies];
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(code => (
          <SelectItem key={code} value={code}>{code} — {CURRENCY_LABELS[code as keyof typeof CURRENCY_LABELS] || code}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
