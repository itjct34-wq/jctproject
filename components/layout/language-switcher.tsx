'use client';

import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/locale-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type LanguageSwitcherProps = {
  /** Compact icon button (top bar / mobile). */
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({ compact = true, className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('common.language')}
          className={cn(
            'inline-flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground',
            compact ? 'h-10 w-10 md:h-9 md:w-9' : 'h-10 gap-2 px-3 text-sm font-medium',
            className
          )}
        >
          <Languages className="h-5 w-5" strokeWidth={1.75} />
          {!compact ? (
            <span className="truncate">{LOCALE_LABELS[locale]}</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {LOCALES.map((code: Locale) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code)}
            className={cn(locale === code && 'bg-brand/10 font-semibold text-brand')}
          >
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
