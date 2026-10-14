'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { countryDisplayName, flagCdnUrl, flagEmoji, normalizeIso2 } from '@/lib/public/countries';

type Props = {
  country?: string | null;
  code?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
};

const SIZES = {
  sm: 'h-4 w-[22px]',
  md: 'h-[22px] w-[30px]',
  lg: 'h-[39px] w-[52px]',
};

export function CountryFlag({ country, code, className, size = 'md', showLabel = false }: Props) {
  const iso = normalizeIso2(code) || normalizeIso2(country);
  const label = countryDisplayName(country || code);
  const [broken, setBroken] = useState(false);

  if (!iso && !label) return null;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {iso && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flagCdnUrl(iso, size === 'lg' ? 80 : 40)}
          alt=""
          aria-hidden="true"
          className={cn(
            SIZES[size],
            'shrink-0 rounded-[3px] border border-[var(--jct-border)] object-cover'
          )}
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className={cn(SIZES[size], 'inline-flex items-center justify-center text-base leading-none')}
          aria-hidden="true"
        >
          {iso ? flagEmoji(iso) : '🌐'}
        </span>
      )}
      {showLabel && label ? (
        <span className="text-sm font-medium text-[var(--jct-navy)]">{label}</span>
      ) : null}
      {!showLabel && label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
