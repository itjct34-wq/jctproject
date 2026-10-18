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
  category: 'stock_category',
  listing_type: 'stock_category',
  stock_cat: 'stock_category',
  part_number: 'part_sku',
  part_no: 'part_sku',
  sku: 'part_sku',
  part: 'part_sku',
  colour: 'color',
  col: 'color',
  port: 'location',
  load_port: 'location',
  pol: 'location',
  fob_price: 'listed_price',
  price: 'listed_price',
  dealer: 'dealership_name',
  dealership: 'dealership_name',
  dealer_name: 'dealership_name',
  once: 'once_price',
  fixed_price: 'once_price',
  once_currency: 'once_price_currency',
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

export type EasySheetKind = 'car' | 'machinery' | 'parts' | 'auctions' | 'third_party';

function styleHeaderRow(row: { height: number; eachCell: (cb: (cell: { font: unknown; fill: unknown; alignment: unknown; border: unknown }) => void) => void }) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2744' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F2744' } },
      bottom: { style: 'thin', color: { argb: 'FF0F2744' } },
    };
  });
}

export async function downloadEasyVehicleWorkbook(kind: EasySheetKind = 'car') {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vehicle Export ERP';
  const kindLabel =
    kind === 'auctions'
      ? 'Auction stock'
      : kind === 'third_party'
        ? 'Third party'
        : kind === 'machinery'
          ? 'Machinery'
          : kind === 'parts'
            ? 'Parts'
            : 'Cars';
  const guide = wb.addWorksheet('How to fill', { views: [{ showGridLines: false }] });
  guide.getColumn(1).width = 92;
  guide.mergeCells('A1:A1');
  guide.getCell('A1').value = `Easy ${kindLabel} sheet — no photo URLs`;
  guide.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF0F2744' } };
  const notes =
    kind === 'auctions'
      ? [
          '1. In the ERP, pick this as Auction stock, then source country and port.',
          '2. Fill chassis, make, model, year, auction date, lot number, start price.',
          '3. Do not paste image URLs. Photos are optional after import.',
          '4. Delete the sample rows before you save.',
        ]
      : kind === 'third_party'
        ? [
            '1. In Bulk upload, choose Third party, then source country and load port.',
            '2. Required: dealership_name, once_price, once_price_currency (JPY or USD), chassis_number, make, model.',
            '3. Optional: model_year, stock_number, color, mileage_km, transmission, fuel_type, notes.',
            '4. Import sets procurement_source = third_party (ERP Third party page; listable on public inventory when in stock).',
            '5. Do not paste image URLs. Photos ZIP after import (folder = chassis). Delete sample rows before save.',
          ]
        : [
          `1. In Bulk upload, choose ${kindLabel}, then source country and load port. Those apply to every row.`,
          '2. Fill chassis, make, model, colour, year, km, transmission, fuel, price.',
          '3. Do not paste image URLs. After import, upload one ZIP: a folder per chassis with jpg/png photos.',
          '4. Folder = chassis (e.g. RU3-123123/). Files: A./A_ auction (ERP only), F. front, B. back.',
          '5. Leave stock_number blank to auto-number. Delete the sample rows before you save.',
        ];
  notes.forEach((line, i) => {
    const cell = guide.getCell(i + 3, 1);
    cell.value = line;
    cell.font = { name: 'Calibri', size: 12, color: { argb: 'FF334155' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    guide.getRow(i + 3).height = 22;
  });

  const sheet = wb.addWorksheet(kindLabel, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const headers =
    kind === 'auctions'
      ? [...AUCTION_CSV_HEADERS]
      : kind === 'third_party'
        ? [...THIRD_PARTY_CSV_HEADERS]
        : [...VEHICLE_CSV_HEADERS];
  const samples =
    kind === 'auctions'
      ? [AUCTION_CSV_SAMPLE]
      : kind === 'third_party'
        ? THIRD_PARTY_CSV_SAMPLES
        : VEHICLE_CSV_SAMPLES;
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);
  const colWidths =
    kind === 'auctions'
      ? [18, 14, 16, 12, 14, 14, 14, 12, 12, 28]
      : kind === 'third_party'
        ? [22, 14, 14, 18, 14, 16, 12, 14, 14, 12, 14, 12, 28]
        : [18, 14, 16, 16, 12, 12, 14, 12, 14, 12, 14, 16, 16, 18, 16, 22, 14, 28];
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = colWidths[i] || 14;
  });
  samples.forEach((sample, idx) => {
    const row = sheet.addRow(sample);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      cell.alignment = { vertical: 'middle' };
    });
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jct-easy-${kind}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
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

/** Easy staff sheet — country/port come from the wizard; photos come from the ZIP. */
export const VEHICLE_CSV_HEADERS = [
  'chassis_number',
  'make',
  'model',
  'color',
  'model_year',
  'mileage_km',
  'transmission',
  'fuel_type',
  'listed_price',
  'listed_currency',
  'stock_number',
  'source_supplier',
  'shipping_port_of_loading',
  'location',
  'destination_country',
  'bid_requester',
  'purchase_price',
  'notes',
];

export const VEHICLE_CSV_SAMPLES: string[][] = [
  [
    'K13-1231234', 'Nissan', 'March', 'Yellow-Green', '2016', '91000',
    'automatic', 'petrol', '4900', 'USD', '', 'USS NAGOYA', 'Nagoya, Japan',
    'Nagoya Main Yard', 'Pakistan', 'agent@example.com', '450000', '',
  ],
  [
    'NZE141000001', 'Toyota', 'Axio', 'Silver', '2018', '62000',
    'cvt', 'petrol', '7200', 'USD', '', 'USS TOKYO', 'Yokohama, Japan',
    'Yokohama Main Yard', 'Kenya', '', '620000', '',
  ],
];

/** @deprecated kept for old wide templates — still parsed if present */
export const VEHICLE_CSV_LEGACY_HEADERS = [
  'source_country',
  'source_country_code',
  'part_sku',
  'model_grade',
  'registration_year',
  'source_supplier',
  'purchase_price',
  'purchase_currency',
  'location',
  'arrival_date',
  'status',
  'primary_image_url',
  'image_urls',
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

export const THIRD_PARTY_CSV_HEADERS = [
  'dealership_name',
  'once_price',
  'once_price_currency',
  'chassis_number',
  'make',
  'model',
  'model_year',
  'stock_number',
  'color',
  'mileage_km',
  'transmission',
  'fuel_type',
  'notes',
];

export const THIRD_PARTY_CSV_SAMPLES: string[][] = [
  [
    'Nagoya Auto Dealer', '1850000', 'JPY', 'KDH201000001', 'Toyota', 'Hiace',
    '2017', '', 'White', '98000', 'automatic', 'diesel', 'Once-price unit',
  ],
  [
    'Osaka Motors Co', '6200', 'USD', 'NZE141000099', 'Toyota', 'Axio',
    '2019', '', 'Silver', '54000', 'cvt', 'petrol', '',
  ],
];

export const CUSTOMER_CSV_HEADERS = [
  'full_name', 'company_name', 'customer_type', 'email', 'phone', 'whatsapp',
  'address_line1', 'country', 'city', 'source', 'status', 'notes',
];

export const CUSTOMER_CSV_SAMPLE = [
  'Amina Hassan', 'Hassan Motors', 'company', 'amina@example.com', '+254700000000', '+254700000000',
  'Bahamas Nassau', 'Bahamas', 'Nassau', 'website', 'lead', 'Prefers hybrids',
];
