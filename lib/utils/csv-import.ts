/** Minimal CSV parser (handles quoted fields) */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
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

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

export function downloadCSVTemplate(filename: string, headers: string[], sampleRow?: string[]) {
  const lines = [headers.join(',')];
  if (sampleRow) lines.push(sampleRow.map((c) => (c.includes(',') ? `"${c}"` : c)).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const VEHICLE_CSV_HEADERS = [
  'chassis_number', 'make', 'model', 'model_grade', 'model_year', 'registration_year',
  'color', 'mileage_km', 'transmission', 'fuel_type', 'source_country', 'source_supplier',
  'purchase_price', 'purchase_currency', 'listed_price', 'listed_currency',
  'location', 'arrival_date', 'status', 'notes', 'primary_image_url',
];

export const VEHICLE_CSV_SAMPLE = [
  'ABC123456789', 'Toyota', 'Prius', 'S', '2019', '2019', 'White', '45000',
  'automatic', 'hybrid', 'Japan', 'USS Tokyo', '800000', 'JPY', '6500', 'USD',
  'Nagoya Yard', '2026-01-15', 'in_stock', 'Clean title', 'https://example.com/car.jpg',
];

export const AUCTION_CSV_HEADERS = [
  'chassis_number', 'make', 'model', 'model_year', 'auction_date', 'lot_number',
  'start_price', 'currency', 'result', 'notes',
];

export const AUCTION_CSV_SAMPLE = [
  'XYZ987654321', 'Honda', 'Fit', '2018', '2026-03-20', 'A-1234',
  '350000', 'JPY', 'pending', 'USS Nagoya',
];
