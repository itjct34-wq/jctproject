'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from '@/lib/i18n/config';
import { messages, type MessageTree } from '@/lib/i18n/messages';

type MessagePath = string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: MessagePath, fallback?: string) => string;
  messages: MessageTree;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = tree;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (path: MessagePath, fallback?: string) => {
      const tree = messages[locale] || messages.en;
      return resolvePath(tree, path) ?? resolvePath(messages.en, path) ?? fallback ?? path;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      messages: messages[locale] || messages.en,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within LocaleProvider');
  }
  return ctx;
}

/** Map nav group English labels → message keys. */
export const NAV_GROUP_I18N: Record<string, string> = {
  Overview: 'nav.overview',
  'Sales & CRM': 'nav.salesCrm',
  'Inventory & Auctions': 'nav.inventoryAuctions',
  Finance: 'nav.finance',
  Operations: 'nav.operations',
  Administration: 'nav.administration',
};

/** Map nav item href → message keys. */
export const NAV_ITEM_I18N: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/customers': 'nav.customers',
  '/inquiries': 'nav.inquiries',
  '/quotations': 'nav.quotations',
  '/agents': 'nav.agentVerification',
  '/my-verification': 'nav.myVerificationCode',
  '/bulk-upload': 'nav.bulkUpload',
  '/vehicles': 'nav.cars',
  '/vehicles?category=machinery': 'nav.machinery',
  '/vehicles?category=parts': 'nav.parts',
  '/vehicles/third-party': 'nav.thirdParty',
  '/vehicles/lifecycle': 'nav.stockPipeline',
  '/auctions': 'nav.auction',
  '/purchases': 'nav.auctionPurchases',
  '/invoices': 'nav.invoices',
  '/auction-invoices': 'nav.auctionInvoices',
  '/payments': 'nav.remittances',
  '/remittance-insights': 'nav.remittanceInsights',
  '/commissions': 'nav.commissions',
  '/expenses': 'nav.accountsExpenses',
  '/ledger': 'nav.agentLedger',
  '/offices': 'nav.officesShifts',
  '/tasks': 'nav.tasksApprovals',
  '/notifications': 'nav.notifications',
  '/reports': 'nav.reports',
  '/blog-admin': 'nav.blogPosts',
  '/users': 'nav.usersTeams',
  '/permissions': 'nav.permissions',
  '/settings': 'nav.systemConfig',
  '/admin/monitor': 'nav.systemMonitor',
  '/configuration': 'nav.globalConfiguration',
  '/configuration#auction-houses': 'nav.auctionHouses',
  '/audit': 'nav.auditLogs',
};
