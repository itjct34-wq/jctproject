export const JCT_OFFICIAL = {
  legalName: 'JAPAN CIRCULAR TRADING CO., LTD.',
  shortName: 'Japan Circular Trading Co., LTD.',
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
  logo: '/images/jct-cars-import-logo.png',
  bank: {
    name: 'RAKUTEN BANK, LTD.',
    branch: 'HEAD OFFICE',
    address: '2-16-5 KONAN, MINATO-KU, TOKYO, JAPAN',
    swift: 'RAKTJPJT OR RAKTJPJTXXX',
    account: '254-7588374',
    beneficiary: 'JAPAN CIRCULAR TRADING CO., LTD.',
    beneficiaryAddress: '2-505-101, DAITORO, NAKAGAWA-KU, NAGOYA CITY, AICHI PREF. JAPAN',
    intermediaryName: 'SUMITOMO MITSUI BANKING CORPORATION, TOKYO, JAPAN',
    intermediarySwift: 'SMBCJPJT',
    intermediaryAddress: '1-1-2 MARUNOUCHI, CHIYODA-KU, TOKYO, JAPAN',
  },
} as const;

export function formatMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function extractChassis(text: string | null | undefined) {
  if (!text) return '';
  const match = text.match(/(?:chassis|chassic|vin)[:\s#-]*([A-Z0-9]{8,20})/i);
  return match?.[1] || '';
}

export function describeInvoiceVehicle(parts: {
  stock_number?: string | null;
  make?: string | null;
  model?: string | null;
  chassis_number?: string | null;
  description?: string | null;
}) {
  const stock = [parts.stock_number, parts.make, parts.model]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');
  const chassis = parts.chassis_number?.trim();
  const chassisBit = chassis
    ? /^chassis\b/i.test(chassis)
      ? chassis
      : `CHASSIS ${chassis}`
    : '';
  const extra = parts.description?.trim() || '';
  const bits = [stock, chassisBit].filter(Boolean);
  if (extra && extra !== stock && !bits.some((bit) => extra.includes(bit))) bits.push(extra);
  return bits.join(' / ') || extra || 'Vehicle';
}
