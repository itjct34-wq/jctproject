/** Neutral letterhead when company_settings.company_name / legal_name are unset. */
export const COMPANY_NAME_FALLBACK = 'Company';

/**
 * Public fallbacks when company_settings logo_url / hanko_url are empty,
 * so invoices & quotations show letterhead/seal immediately.
 */
export const COMPANY_LOGO_PUBLIC_FALLBACK = '/images/company-logo.png';
export const COMPANY_HANKO_PUBLIC_FALLBACK = '/images/company-hanko.png';

export type CompanyLetterheadSettings = {
  company_name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  hanko_url?: string | null;
};

/** Prefer org settings for visible company name; never hard-code a brand wordmark. */
export function letterheadName(settings?: CompanyLetterheadSettings | null) {
  const legal = settings?.legal_name?.trim();
  const company = settings?.company_name?.trim();
  return legal || company || COMPANY_NAME_FALLBACK;
}

/** Letterhead logo: settings URL first, then optional public fallback path. */
export function letterheadLogoUrl(settings?: CompanyLetterheadSettings | null) {
  const fromSettings = settings?.logo_url?.trim();
  if (fromSettings) return fromSettings;
  return COMPANY_LOGO_PUBLIC_FALLBACK || '';
}

/** Hanko / company seal: settings URL first, then optional public fallback path. */
export function letterheadHankoUrl(settings?: CompanyLetterheadSettings | null) {
  const fromSettings = settings?.hanko_url?.trim();
  if (fromSettings) return fromSettings;
  return COMPANY_HANKO_PUBLIC_FALLBACK || '';
}

export const JCT_OFFICIAL = {
  /** Prefer letterheadName(company_settings); kept empty so UI does not show a hard-coded brand. */
  legalName: '',
  shortName: '',
  tagline: 'EXPORT / IMPORT TRADE / USED CARS / TRUCKS',
  address: '2-505-101, DAITORO, NAKAGAWA-KU, NAGOYA-SHI, AICHI-KEN 454-0943 JAPAN',
  addressLetter: '2-505-101,Daitoro,Nakagawa-ku, Nagoya-shi, Aichi-ken,454-0943 Japan',
  fax: '052-717-4476',
  phone: '090-6463-4737',
  phoneIntl: '+81-52-717-4476',
  email: 'info.jct000@gmail.com',
  website: 'www.japancirculartrading.com',
  director: 'SAID NAWAZ',
  directorTitle: 'Representative Director',
  corporateNumber: '8180001159348',
  license: 'Aichi Prefecture Public Safety Commission No. 541212314700',
  /** Logo marks removed from product UI; do not point at brand image assets. */
  logo: '',
  bank: {
    name: 'RAKUTEN BANK, LTD.',
    branch: 'HEAD OFFICE',
    address: '2-16-5 KONAN, MINATO-KU, TOKYO, JAPAN',
    swift: 'RAKTJPJT OR RAKTJPJTXXX',
    account: '254-7588374',
    /** Wire beneficiary — prefer company_settings.legal_name / company_name when rendering docs. */
    beneficiary: COMPANY_NAME_FALLBACK,
    beneficiaryAddress: '2-505-101, DAITORO, NAKAGAWA-KU, NAGOYA CITY, AICHI PREF. JAPAN',
    intermediaryName: 'SUMITOMO MITSUI BANKING CORPORATION, TOKYO, JAPAN',
    intermediarySwift: 'SMBCJPJT',
    intermediaryAddress: '1-1-2 MARUNOUCHI, CHIYODA-KU, TOKYO, JAPAN',
  },
} as const;

export function formatMoney(amount: number, currency: string) {
  const n = Math.round(Number(amount || 0));
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function extractChassis(text: string | null | undefined) {
  if (!text) return '';
  const match = text.match(/(?:chassis|chassic|vin)[:\s#-]*([A-Z0-9-]{8,20})/i);
  return match?.[1] || '';
}

/** Print-only: prefix NO. in front of the exact stored/typed code. Does not strip hyphens or rewrite the code. */
export function formatDocumentNo(code: string | null | undefined) {
  const raw = (code || '').trim();
  if (!raw) return 'NO.—';
  const exact = raw.replace(/^NO\.?\s*/i, '').trim();
  return exact ? `NO.${exact}` : 'NO.—';
}

export const formatInvoiceNumber = formatDocumentNo;

export type InvoiceVehicleBits = {
  chassis_number?: string | null;
  stock_number?: string | null;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  year?: string | null;
  engine?: string | null;
  transmission?: string | null;
  notes?: string | null;
};

export function formatTransmissionLabel(value?: string | null) {
  const v = (value || '').trim();
  if (!v) return '';
  const key = v.toLowerCase().replace(/\.$/, '');
  if (key === 'automatic' || key === 'auto' || key === 'cvt') return 'Automatic';
  if (key === 'manual') return 'Manual';
  return v.replace(/\.$/, '');
}

export const DEPOSIT_RATIOS = [30, 70, 100] as const;

export function formatDepositRatio(discount?: number | string | null, unitPrice?: number | string | null) {
  const n = Number(discount || 0);
  if (!n) return '—';
  if (n === 30 || n === 70 || n === 100) return `${n}%`;
  if (n > 0 && n <= 100) return `${Math.round(n)}%`;
  const price = Number(unitPrice || 0);
  if (price > 0) return `${Math.max(0, Math.min(100, Math.round((n / price) * 100)))}%`;
  return '—';
}

export function normalizeDepositRatio(discount?: number | string | null, unitPrice?: number | string | null): (typeof DEPOSIT_RATIOS)[number] {
  const n = Number(discount || 0);
  if (n === 30 || n === 70 || n === 100) return n;
  let pct = n;
  if (n > 100 && Number(unitPrice) > 0) pct = (n / Number(unitPrice)) * 100;
  if (pct <= 50) return 30;
  if (pct <= 85) return 70;
  return 100;
}

export function isJctvEncodedDescription(description: string | null | undefined) {
  return (description || '').trimStart().startsWith('[JCTV]');
}

export function describeInvoiceVehicle(parts: InvoiceVehicleBits & { description?: string | null }) {
  const notes = (parts.notes ?? parts.description)?.trim() || '';
  const fields = [
    ['chassis', parts.chassis_number],
    ['stock', parts.stock_number],
    ['make', parts.make],
    ['model', parts.model],
    ['colour', parts.colour],
    ['year', parts.year],
    ['engine', parts.engine],
    ['transmission', parts.transmission],
  ] as const;
  const encoded = fields
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `${key}=${String(value).trim().replace(/\|/g, '/')}`)
    .join(' | ');
  if (encoded && notes) return `[JCTV] ${encoded} || ${notes}`;
  if (encoded) return `[JCTV] ${encoded}`;
  return notes || 'Vehicle';
}

/**
 * Persist a line description for invoices/quotations.
 * Manual free-text (no stock vehicle_id + typed description) is stored verbatim so print
 * can show the same layout. Stock-linked / structured-only lines still use [JCTV] encoding.
 */
export function encodeInvoiceLineDescription(
  parts: InvoiceVehicleBits & { description?: string | null; vehicle_id?: string | null }
) {
  const notes = (parts.notes ?? parts.description)?.trim() || '';
  if (!parts.vehicle_id && notes) return notes;
  return describeInvoiceVehicle({ ...parts, notes });
}

export function decodeInvoiceVehicle(description: string | null | undefined): InvoiceVehicleBits {
  const text = (description || '').trim();
  if (!text) return {};
  if (isJctvEncodedDescription(text)) {
    const rest = text.replace(/^\[JCTV\]\s*/i, '');
    const [meta, notes] = rest.split(/\s\|\|\s/);
    const bits: Record<string, string> = {};
    (meta || '').split(/\s\|\s/).forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) bits[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
    return {
      chassis_number: bits.chassis || '',
      stock_number: bits.stock || '',
      make: bits.make || '',
      model: bits.model || '',
      colour: bits.colour || '',
      year: bits.year || '',
      engine: bits.engine || '',
      transmission: bits.transmission || '',
      notes: (notes || '').trim(),
    };
  }
  // Plain free-text (manual paste): keep verbatim. Do not invent make/model from heuristics.
  return { notes: text };
}

/** True when the line should print the description box text as-is (no structured make/model layout). */
export function isFreeformInvoiceVehicle(
  bits: InvoiceVehicleBits,
  opts?: { vehicle_id?: string | null; make?: string | null; model?: string | null }
) {
  if (opts?.vehicle_id) return false;
  if (opts?.make?.trim() || opts?.model?.trim()) return false;
  if (bits.make?.trim() || bits.model?.trim()) return false;
  return Boolean(bits.notes?.trim());
}
