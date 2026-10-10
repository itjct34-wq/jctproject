'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, type SupportedCurrency } from '@/lib/utils/currencies';

type Props = {
  value: string;
  onValueChange: (value: SupportedCurrency) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function CurrencySelect({ value, onValueChange, placeholder = 'Currency', className, disabled }: Props) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onValueChange(v as SupportedCurrency)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c} — {CURRENCY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
