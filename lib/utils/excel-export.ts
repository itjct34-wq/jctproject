import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: string;
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  infoSheet?: { title: string; details: Record<string, string> } | null,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JCT ERP';
  workbook.created = new Date();

  if (infoSheet) {
    const info = workbook.addWorksheet('Export Info');
    info.columns = [{ header: 'Property', key: 'property', width: 25 }, { header: 'Value', key: 'value', width: 50 }];
    info.getRow(1).font = { bold: true };
    Object.entries(infoSheet.details).forEach(([key, value]) => {
      info.addRow({ property: key, value });
    });
  }

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 18,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'left' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };

  rows.forEach((row) => {
    const added = sheet.addRow(row);
    columns.forEach((col) => {
      if (col.format && typeof row[col.key] === 'number') {
        const cell = added.getCell(col.key);
        cell.numFmt = col.format;
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function sanitizeForExcel(value: unknown): unknown {
  if (typeof value === 'string' && (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@'))) {
    return `'${value}`;
  }
  return value;
}
