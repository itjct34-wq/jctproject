import ExcelJS from 'exceljs';
import type { Invoice, InvoiceItem, Customer } from '@/lib/types';

const RED = 'E30613';
const BLACK = '0D0D0D';
const GRAY = 'F5F5F5';

export async function exportCommercialInvoiceExcel(opts: {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  verifyUrl?: string;
}) {
  const { invoice, items, customer, verifyUrl } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Japan Circular Trading';
  wb.created = new Date();

  const ws = wb.addWorksheet('Invoice', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { width: 4 }, { width: 6 }, { width: 28 }, { width: 12 }, { width: 18 },
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
  ];

  ws.mergeCells('B2:F2');
  ws.getCell('B2').value = 'JAPAN CIRCULAR TRADING';
  ws.getCell('B2').font = { name: 'Arial', size: 18, bold: true, color: { argb: RED } };

  ws.mergeCells('B3:F3');
  ws.getCell('B3').value = 'Car Importing & Exporting Xpert';
  ws.getCell('B3').font = { name: 'Arial', size: 9, italic: true, color: { argb: '666666' } };

  ws.mergeCells('B4:F4');
  ws.getCell('B4').value = '2-505-101 Daitoro, Nakagawa-ku, Nagoya, Aichi 454-0943, Japan';
  ws.getCell('B4').font = { name: 'Arial', size: 8, color: { argb: '666666' } };

  ws.mergeCells('B5:F5');
  ws.getCell('B5').value = 'Tel: +81 70-2241-6356  |  info@japancirculartrading.com';
  ws.getCell('B5').font = { name: 'Arial', size: 8, color: { argb: '666666' } };

  ws.mergeCells('H2:J2');
  ws.getCell('H2').value = 'INVOICE';
  ws.getCell('H2').font = { name: 'Arial', size: 24, bold: true };
  ws.getCell('H2').alignment = { horizontal: 'right' };

  ws.mergeCells('H3:J3');
  ws.getCell('H3').value = invoice.invoice_code;
  ws.getCell('H3').font = { name: 'Arial', size: 11, bold: true };
  ws.getCell('H3').alignment = { horizontal: 'right' };

  for (let c = 2; c <= 10; c++) {
    ws.getCell(6, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  }
  ws.getRow(6).height = 4;

  ws.getCell('B8').value = 'Date';
  ws.getCell('B8').font = { size: 8, color: { argb: '888888' } };
  ws.getCell('C8').value = invoice.issue_date;
  ws.getCell('C8').font = { bold: true };

  ws.getCell('D8').value = 'Currency';
  ws.getCell('D8').font = { size: 8, color: { argb: '888888' } };
  ws.getCell('E8').value = invoice.currency;
  ws.getCell('E8').font = { bold: true };

  ws.getCell('F8').value = 'Incoterms';
  ws.getCell('F8').font = { size: 8, color: { argb: '888888' } };
  ws.getCell('G8').value = invoice.incoterms || 'FOB';
  ws.getCell('G8').font = { bold: true };

  ws.getCell('H8').value = 'Type';
  ws.getCell('H8').font = { size: 8, color: { argb: '888888' } };
  ws.getCell('I8').value = invoice.shipment_type || 'RORO';
  ws.getCell('I8').font = { bold: true };

  ws.mergeCells('B10:J10');
  ws.getCell('B10').value = '  SHIPPING TERMS';
  ws.getCell('B10').font = { size: 9, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell('B10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };

  const shipData: [string, string][] = [
    ['Mode', invoice.container_mode || 'RORO Vessel'],
    ['POL', invoice.port_of_loading || 'Nagoya, Japan'],
    ['POD', invoice.port_of_discharge || ''],
    ['Vessel', invoice.vessel_name || ''],
    ['BL No', invoice.bl_number || ''],
  ];
  let col = 2;
  shipData.forEach(([lab, val]) => {
    ws.getCell(11, col).value = lab;
    ws.getCell(11, col).font = { size: 7, color: { argb: '888888' } };
    ws.getCell(11, col + 1).value = val;
    ws.getCell(11, col + 1).font = { size: 9, bold: true };
    col += 2;
  });

  ws.mergeCells('B13:E13');
  ws.getCell('B13').value = '  SELLER';
  ws.getCell('B13').font = { size: 9, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell('B13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };

  ws.mergeCells('G13:J13');
  ws.getCell('G13').value = '  BUYER / CONSIGNEE';
  ws.getCell('G13').font = { size: 9, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell('G13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };

  const sellerLines = [
    'Japan Circular Trading',
    '2-505-101 Daitoro, Nakagawa-ku',
    'Nagoya, Aichi 454-0943, Japan',
    '+81 70-2241-6356',
    'info@japancirculartrading.com',
  ];
  sellerLines.forEach((line, i) => {
    ws.mergeCells(`B${14 + i}:E${14 + i}`);
    ws.getCell(`B${14 + i}`).value = line;
    ws.getCell(`B${14 + i}`).font = { size: 8 };
    ws.getCell(`B${14 + i}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
  });

  const buyerLines = [
    customer?.full_name || '',
    customer?.address_line1 || '',
    [customer?.city, customer?.country].filter(Boolean).join(', '),
    customer?.phone || '',
    customer?.email || '',
  ];
  buyerLines.forEach((line, i) => {
    ws.mergeCells(`G${14 + i}:J${14 + i}`);
    ws.getCell(`G${14 + i}`).value = line;
    ws.getCell(`G${14 + i}`).font = { size: 8 };
  });

  ws.mergeCells('B20:J20');
  ws.getCell('B20').value = '  VEHICLE / CARGO DETAILS';
  ws.getCell('B20').font = { size: 9, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell('B20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } };

  const headers = ['#', 'Description', 'Qty', 'Unit Price', 'Discount', 'Amount'];
  const headerCols = [2, 3, 5, 7, 8, 9];
  headers.forEach((h, i) => {
    const cell = ws.getCell(21, headerCols[i]);
    cell.value = h;
    cell.font = { size: 8, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
    cell.alignment = { horizontal: i === 1 ? 'left' : 'right' };
  });
  ws.mergeCells('C21:D21');

  items.forEach((item, idx) => {
    const r = 22 + idx;
    ws.getCell(r, 2).value = idx + 1;
    ws.mergeCells(`C${r}:D${r}`);
    ws.getCell(r, 3).value = item.description;
    ws.getCell(r, 5).value = item.quantity;
    ws.getCell(r, 7).value = Number(item.unit_price);
    ws.getCell(r, 7).numFmt = '#,##0.00';
    ws.getCell(r, 8).value = Number(item.discount || 0);
    ws.getCell(r, 8).numFmt = '#,##0.00';
    ws.getCell(r, 9).value = Number(item.line_total);
    ws.getCell(r, 9).numFmt = '#,##0.00';
    [2, 3, 5, 7, 8, 9].forEach((c) => {
      ws.getCell(r, c).font = { size: 8 };
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: 'DDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
        left: { style: 'thin', color: { argb: 'DDDDDD' } },
        right: { style: 'thin', color: { argb: 'DDDDDD' } },
      };
    });
  });

  const totalStart = 22 + Math.max(items.length, 1) + 1;
  const freight = Number(invoice.freight_total || 0);
  const insurance = Number(invoice.insurance_total || 0);
  const other = Number(invoice.other_charges || 0);
  const discount = Number(invoice.discount_total || 0);
  const grand =
    Number(invoice.subtotal || 0) +
    Number(invoice.tax || 0) +
    freight +
    insurance +
    other -
    discount;

  const totals: [string, number][] = [
    ['Subtotal', Number(invoice.subtotal)],
    ['Tax', Number(invoice.tax)],
    ['Freight', freight],
    ['Insurance', insurance],
    ['Other charges', other],
    ['Discount', -discount],
  ];
  totals.forEach(([lab, val], i) => {
    const r = totalStart + i;
    ws.mergeCells(`B${r}:H${r}`);
    ws.getCell(`B${r}`).value = lab;
    ws.getCell(`B${r}`).alignment = { horizontal: 'right' };
    ws.getCell(`B${r}`).font = { size: 8, color: { argb: '666666' } };
    ws.getCell(r, 9).value = val;
    ws.getCell(r, 9).numFmt = '#,##0.00';
    ws.getCell(r, 9).font = { size: 9 };
  });

  const gt = totalStart + totals.length;
  ws.mergeCells(`B${gt}:H${gt}`);
  ws.getCell(`B${gt}`).value = 'GRAND TOTAL';
  ws.getCell(`B${gt}`).font = { size: 11, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell(`B${gt}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  ws.getCell(`B${gt}`).alignment = { horizontal: 'right' };
  for (let c = 2; c <= 8; c++) {
    ws.getCell(gt, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
  }
  ws.getCell(gt, 9).value = grand;
  ws.getCell(gt, 9).numFmt = `"${invoice.currency}"#,##0.00`;
  ws.getCell(gt, 9).font = { size: 12, bold: true, color: { argb: 'FFFFFF' } };
  ws.getCell(gt, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };

  if (verifyUrl) {
    const vr = gt + 2;
    ws.mergeCells(`B${vr}:J${vr}`);
    ws.getCell(`B${vr}`).value = `Verify authenticity: ${verifyUrl}`;
    ws.getCell(`B${vr}`).font = { size: 8, color: { argb: '0066CC' } };
  }

  const nr = gt + 4;
  ws.mergeCells(`B${nr}:J${nr}`);
  ws.getCell(`B${nr}`).value =
    'Terms: Vehicles sold as-is. Title & risk per Incoterms. Full payment before document release. Japanese law / Nagoya jurisdiction.';
  ws.getCell(`B${nr}`).font = { size: 7, color: { argb: '888888' } };

  if (invoice.notes) {
    ws.mergeCells(`B${nr + 1}:J${nr + 1}`);
    ws.getCell(`B${nr + 1}`).value = `Notes: ${invoice.notes}`;
    ws.getCell(`B${nr + 1}`).font = { size: 8 };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoice_code}_Commercial_Invoice.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
