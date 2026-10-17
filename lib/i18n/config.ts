export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
};

export const LOCALE_STORAGE_KEY = 'jct-erp-locale';

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ja';
}
