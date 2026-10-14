/** Minimal CSV parser (handles quoted fields) */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
  chassis: 'chassis_number',
  chassis_no: 'chassis_number',
  chassis_num: 'chassis_number',
  vin: 'chassis_number',
  year: 'model_year',
  mileage: 'mileage_km',
  km: 'mileage_km',
  country: 'source_country',
  country_name: 'source_country',
  source: 'source_country',
  country_code: 'source_country_code',
  iso: 'source_country_code',
  iso2: 'source_country_code',
  iso_code: 'source_country_code',
  image: 'primary_image_url',
  image_url: 'primary_image_url',
  photo: 'primary_image_url',
  photo_url: 'primary_image_url',
  photos: 'image_urls',
  images: 'image_urls',
  image_url_list: 'image_urls',
};

function applyHeaderAlias(header: string): string {
  return HEADER_ALIASES[header] || header;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => applyHeaderAlias(normalizeHeader(h)));
  const rows = lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      row[h] = cols[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join('').trim();
    if (obj.result !== undefined) return cellToString(obj.result);
  }
  return String(value).trim();
}

export async function parseSpreadsheetFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheet = wb.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };
    const matrix: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (cells.length < colNumber - 1) cells.push('');
        cells.push(cellToString(cell.value));
      });
      if (cells.some((c) => c.length > 0)) matrix.push(cells);
    });
    if (matrix.length === 0) return { headers: [], rows: [] };
    const headers = (matrix[0] || []).map((h) => applyHeaderAlias(normalizeHeader(h)));
    const rows = matrix.slice(1).map((cols) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        row[h] = cols[i] ?? '';
      });
      return row;
    });
    return { headers, rows };
  }
  return parseCSV(await file.text());
}

export function downloadCSVTemplate(
  filename: string,
  headers: string[],
  sampleRow?: string[] | string[][]
) {
  const samples: string[][] = !sampleRow
    ? []
    : Array.isArray(sampleRow[0])
      ? (sampleRow as string[][])
      : [sampleRow as string[]];
  const escape = (c: string) => (c.includes(',') || c.includes('"') || c.includes('\n') ? `"${c.replace(/"/g, '""')}"` : c);
  const lines = [headers.join(',')];
  for (const sample of samples) lines.push(sample.map(escape).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseOptionalNumber(raw: string | undefined): { ok: true; value: number | null } | { ok: false } {
  const s = (raw || '').trim().replace(/,/g, '');
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
}

export function splitImageUrls(row: Record<string, string>): string[] {
  const blob = [row.image_urls, row.primary_image_url].filter(Boolean).join('|');
  return blob
    .split(/[|,;\n]/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export const VEHICLE_CSV_HEADERS = [
  'source_country',
  'source_country_code',
  'chassis_number',
  'make',
  'model',
  'model_grade',
  'model_year',
  'registration_year',
  'color',
  'mileage_km',
  'transmission',
  'fuel_type',
  'source_supplier',
  'purchase_price',
  'purchase_currency',
  'listed_price',
  'listed_currency',
  'location',
  'arrival_date',
  'status',
  'notes',
  'primary_image_url',
  'image_urls',
]; // image URL columns are optional — bulk photos are usually a separate chassis-folder ZIP

export const VEHICLE_CSV_SAMPLES: string[][] = [
  [
    'Japan', 'JP', 'ABC123456789', 'Toyota', 'Prius', 'S', '2019', '2019', 'White', '45000',
    'automatic', 'hybrid', 'USS Tokyo', '800000', 'JPY', '6500', 'USD',
    'Nagoya Yard', '2026-01-15', 'in_stock', 'Clean title',
    'https://example.com/prius.jpg', 'https://example.com/prius-2.jpg',
  ],
  [
    'United Arab Emirates', 'AE', 'NZE141000001', 'Toyota', 'Axio', 'X', '2018', '2018', 'Silver', '62000',
    'cvt', 'petrol', 'Dubai yard', '9000', 'AED', '7200', 'USD',
    'Dubai', '2026-02-01', 'in_stock', '',
    'https://example.com/axio.jpg', '',
  ],
  [
    'United Kingdom', 'GB', 'NCP81Z000002', 'Honda', 'Fit', 'RS', '2017', '2017', 'Blue', '51000',
    'automatic', 'petrol', 'UK stock', '4500', 'GBP', '5800', 'USD',
    'Felixstowe', '2026-03-01', 'in_stock', '',
    '', '',
  ],
];

/** @deprecated use VEHICLE_CSV_SAMPLES */
export const VEHICLE_CSV_SAMPLE = VEHICLE_CSV_SAMPLES[0];

export const AUCTION_CSV_HEADERS = [
  'chassis_number', 'make', 'model', 'model_year', 'auction_date', 'lot_number',
  'start_price', 'currency', 'result', 'notes',
];

export const AUCTION_CSV_SAMPLE = [
  'XYZ987654321', 'Honda', 'Fit', '2018', '2026-03-20', 'A-1234',
  '350000', 'JPY', 'pending', 'USS Nagoya',
];

export const CUSTOMER_CSV_HEADERS = [
  'full_name', 'company_name', 'customer_type', 'email', 'phone', 'whatsapp',
  'country', 'city', 'source', 'status', 'notes',
];

export const CUSTOMER_CSV_SAMPLE = [
  'Amina Hassan', 'Hassan Motors', 'company', 'amina@example.com', '+254700000000', '+254700000000',
  'Kenya', 'Nairobi', 'website', 'lead', 'Prefers hybrids',
];
