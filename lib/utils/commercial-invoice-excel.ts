import ExcelJS from 'exceljs';
import type { Invoice, InvoiceItem, Customer, Quotation } from '@/lib/types';
import {
  decodeInvoiceVehicle,
  extractChassis,
  formatDepositRatio,
  formatDocumentNo,
  isFreeformInvoiceVehicle,
} from '@/lib/jct-official';
import {
  applyFreightToVehicleLines,
  filterFreightChargeLines,
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveDocumentFreightDisplay,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';

type TradeLine = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount?: number;
};

const NAVY = '0B1F3A';
const RED = 'C4161C';
const WHITE = 'FFFFFF';
const THIN = { style: 'thin' as const, color: { argb: NAVY } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

type ExcelLine = {
  chassis: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  deposit?: string;
};

function headerFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function styleHeader(cell: ExcelJS.Cell, fill = NAVY) {
  cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: WHITE } };
  cell.fill = headerFill(fill);
  cell.border = BORDER;
  cell.alignment = { vertical: 'middle', wrapText: true };
}

function styleBody(cell: ExcelJS.Cell, opts?: { bold?: boolean; align?: ExcelJS.Alignment['horizontal'] }) {
  cell.font = { name: 'Arial', size: 9, bold: opts?.bold };
  cell.border = BORDER;
  cell.alignment = { vertical: 'middle', horizontal: opts?.align || 'left', wrapText: true };
}

function money(n: number) {
  return Number(n || 0);
}

function lineFromItem(item: InvoiceItem | TradeLine): ExcelLine {
  const bits = decodeInvoiceVehicle(item.description);
  const vehicleId = 'vehicle_id' in item ? item.vehicle_id : null;
  const freeform = isFreeformInvoiceVehicle(bits, {
    vehicle_id: vehicleId,
    make: 'make' in item ? item.make : null,
    model: 'model' in item ? item.model : null,
  });
  const chassis =
    bits.chassis_number ||
    extractChassis(freeform ? bits.notes : item.description) ||
    '—';
  const car = freeform
    ? (bits.notes || item.description || '').trim()
    : [bits.make, bits.model, bits.year, bits.engine].filter(Boolean).join(' ') || item.description;
  const extra = freeform ? '' : [bits.colour, bits.transmission].filter(Boolean).join(' · ');
  const qty = Number(item.quantity || 1);
  const unit = Number(item.unit_price || 0);
  const total = Number(item.line_total || 0) || qty * unit;
  const deposit =
    'discount' in item ? formatDepositRatio((item as InvoiceItem).discount, unit) : undefined;
  return {
    chassis,
    description: extra ? `${car} (${extra})` : car,
    quantity: qty,
    unit_price: unit,
    line_total: total,
    deposit,
  };
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTradeDocumentExcel(opts: {
  title: string;
  documentNo: string;
  issueDate: string;
  currency: string;
  customer?: Customer | null;
  shipmentType?: string | null;
  shipmentMode?: string | null;
  shipmentTerm?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  lines: ExcelLine[];
  vehiclesTotal: number;
  freight: number;
  freightNotes?: string | null;
  insurance?: number;
  other?: number;
  discount?: number;
  grandTotal: number;
  verifyUrl?: string;
  notes?: string | null;
  filename: string;
  showDeposit?: boolean;
  showFreight?: boolean;
}) {
  const freightPolicy = resolveFreightPolicy({
    incoterm: opts.shipmentTerm,
    shipmentType: opts.shipmentType,
    containerMode: opts.shipmentMode,
  });
  const freightDisplay = resolveDocumentFreightDisplay(freightPolicy, opts.freight);
  const freight = freightDisplay.documentFreight;
  const freightNotes =
    normalizeFreightNotes(freightPolicy, opts.freightNotes) || freightPolicy.defaultFreightLabel;
  const showFreight = opts.showFreight ?? freightDisplay.showFreightBlock;
  const vehiclesTotal = Number(opts.vehiclesTotal || 0) + freightDisplay.vehiclesFreightAddon;
  const insurance = Number(opts.insurance || 0);
  const other = Number(opts.other || 0);
  const discount = Number(opts.discount || 0);
  // Prefer caller grand total when freight is shown separately or rolled (keeps tax etc.).
  const grandTotal =
    !freightPolicy.allowFreight && !freightPolicy.rollFreightIntoVehicleCost
      ? vehiclesTotal + insurance + other - discount
      : Number(opts.grandTotal || 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vehicle Export ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.title, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Chassis + Vehicle + Qty + [Deposit] + Total (no unit price column)
  const lastCol = opts.showDeposit ? 5 : 4;
  ws.columns = [
    { width: 18 },
    { width: 36 },
    { width: 10 },
    ...(opts.showDeposit ? [{ width: 12 }] : []),
    { width: 16 },
  ];

  const mergeTo = (row: number) => {
    ws.mergeCells(row, 1, row, lastCol);
  };

  mergeTo(1);
  ws.getCell(1, 1).value = 'Company';
  ws.getCell(1, 1).font = { name: 'Arial', size: 16, bold: true, color: { argb: NAVY } };

  mergeTo(2);
  ws.getCell(2, 1).value = opts.title;
  ws.getCell(2, 1).font = { name: 'Arial', size: 14, bold: true, color: { argb: RED } };

  mergeTo(3);
  ws.getCell(3, 1).value = formatDocumentNo(opts.documentNo);
  ws.getCell(3, 1).font = { name: 'Arial', size: 11, bold: true };

  const consignee = [
    customerLabel('Name', opts.customer?.company_name || opts.customer?.full_name),
    customerLabel('contact', opts.customer?.phone || opts.customer?.whatsapp),
    customerLabel('Email', opts.customer?.email),
    customerLabel(
      'Address',
      [opts.customer?.address_line1, opts.customer?.city, opts.customer?.country].filter(Boolean).join(', ')
    ),
  ].join('\n');

  ws.getCell(5, 1).value = 'Consignee';
  styleHeader(ws.getCell(5, 1));
  ws.mergeCells(5, 2, 5, lastCol);
  ws.getCell(5, 2).value = consignee;
  styleBody(ws.getCell(5, 2));
  ws.getRow(5).height = 56;

  const meta = [
    ['Date', opts.issueDate, 'Currency', opts.currency],
    ['Type', opts.shipmentType || 'RORO', 'Mode', opts.shipmentMode || ''],
    ['Term', opts.shipmentTerm || 'FOB', 'POL', opts.portOfLoading || 'Nagoya, Japan'],
    ['POD', opts.portOfDischarge || '—', '', ''],
  ];
  let row = 7;
  meta.forEach((pair) => {
    ws.getCell(row, 1).value = pair[0];
    styleHeader(ws.getCell(row, 1));
    ws.getCell(row, 2).value = pair[1];
    styleBody(ws.getCell(row, 2));
    if (pair[2]) {
      ws.getCell(row, 3).value = pair[2];
      styleHeader(ws.getCell(row, 3));
      ws.mergeCells(row, 4, row, lastCol);
      ws.getCell(row, 4).value = pair[3];
      styleBody(ws.getCell(row, 4));
    } else {
      ws.mergeCells(row, 2, row, lastCol);
    }
    row += 1;
  });

  row += 1;
  mergeTo(row);
  ws.getCell(row, 1).value = 'VEHICLES';
  styleHeader(ws.getCell(row, 1), NAVY);
  row += 1;

  const vehicleHeaders = opts.showDeposit
    ? ['Chassis', 'Vehicle', 'Qty', 'Deposit', 'Total']
    : ['Chassis', 'Vehicle', 'Qty', 'Total'];
  vehicleHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeader(cell, RED);
    cell.alignment = { horizontal: i >= 2 ? 'right' : 'left', vertical: 'middle' };
  });
  row += 1;

  const rawLines = opts.lines.length
    ? opts.lines
    : [{ chassis: '—', description: '—', quantity: 1, unit_price: 0, line_total: 0 }];
  const baseLines = filterFreightChargeLines(rawLines, freightPolicy);
  const lines = applyFreightToVehicleLines(baseLines, freightDisplay.vehiclesFreightAddon);
  lines.forEach((line) => {
    const values = opts.showDeposit
      ? [line.chassis, line.description, line.quantity, line.deposit || '—', money(line.line_total)]
      : [line.chassis, line.description, line.quantity, money(line.line_total)];
    values.forEach((val, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = val as ExcelJS.CellValue;
      styleBody(cell, { align: i >= 2 ? 'right' : 'left' });
      const isMoneyCol = i === values.length - 1;
      if (typeof val === 'number' && isMoneyCol) cell.numFmt = '#,##0.00';
    });
    row += 1;
  });

  const vehiclesTotalLabel = showFreight ? 'Vehicles total' : 'Total';
  // RORO (no separate freight): skip intermediate blue Total; GRAND TOTAL is enough.
  if (showFreight) {
    ws.mergeCells(row, 1, row, lastCol - 1);
    ws.getCell(row, 1).value = vehiclesTotalLabel;
    styleHeader(ws.getCell(row, 1));
    ws.getCell(row, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(row, lastCol).value = money(vehiclesTotal);
    ws.getCell(row, lastCol).numFmt = '#,##0.00';
    styleHeader(ws.getCell(row, lastCol));
    row += 2;
  } else {
    row += 1;
  }

  if (showFreight) {
    mergeTo(row);
    ws.getCell(row, 1).value = 'FREIGHT';
    styleHeader(ws.getCell(row, 1), NAVY);
    row += 1;
    ws.mergeCells(row, 1, row, lastCol - 2);
    ws.getCell(row, 1).value = 'Description';
    styleHeader(ws.getCell(row, 1), RED);
    ws.getCell(row, lastCol - 1).value = 'Currency';
    styleHeader(ws.getCell(row, lastCol - 1), RED);
    ws.getCell(row, lastCol).value = 'Amount';
    styleHeader(ws.getCell(row, lastCol), RED);
    row += 1;
    ws.mergeCells(row, 1, row, lastCol - 2);
    ws.getCell(row, 1).value = freightNotes;
    styleBody(ws.getCell(row, 1));
    ws.getCell(row, lastCol - 1).value = opts.currency;
    styleBody(ws.getCell(row, lastCol - 1));
    ws.getCell(row, lastCol).value = money(freight);
    ws.getCell(row, lastCol).numFmt = '#,##0.00';
    styleBody(ws.getCell(row, lastCol), { align: 'right' });
    row += 1;
    ws.mergeCells(row, 1, row, lastCol - 1);
    ws.getCell(row, 1).value = 'Freight total';
    styleHeader(ws.getCell(row, 1));
    ws.getCell(row, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(row, lastCol).value = money(freight);
    ws.getCell(row, lastCol).numFmt = '#,##0.00';
    styleHeader(ws.getCell(row, lastCol));
    row += 2;
  }

  mergeTo(row);
  ws.getCell(row, 1).value = 'TOTALS';
  styleHeader(ws.getCell(row, 1), NAVY);
  row += 1;

  const hasExtra = showFreight || !!insurance || !!other || !!discount;
  const totals: [string, number, boolean?][] = hasExtra ? [[vehiclesTotalLabel, vehiclesTotal]] : [];
  if (showFreight) totals.push(['Freight', freight]);
  if (insurance) totals.push(['Insurance', insurance]);
  if (other) totals.push(['Other charges', other]);
  if (discount) totals.push(['Discount', -discount]);
  totals.forEach(([lab, val]) => {
    ws.mergeCells(row, 1, row, lastCol - 1);
    ws.getCell(row, 1).value = lab;
    styleBody(ws.getCell(row, 1), { align: 'right' });
    ws.getCell(row, lastCol).value = money(val);
    ws.getCell(row, lastCol).numFmt = '#,##0.00';
    styleBody(ws.getCell(row, lastCol), { align: 'right' });
    row += 1;
  });
  ws.mergeCells(row, 1, row, lastCol - 1);
  ws.getCell(row, 1).value = 'GRAND TOTAL';
  styleHeader(ws.getCell(row, 1), RED);
  ws.getCell(row, 1).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(row, lastCol).value = money(grandTotal);
  ws.getCell(row, lastCol).numFmt = `"${opts.currency}"#,##0.00`;
  styleHeader(ws.getCell(row, lastCol), RED);
  row += 2;

  if (opts.notes) {
    mergeTo(row);
    ws.getCell(row, 1).value = `Notes: ${opts.notes}`;
    ws.getCell(row, 1).font = { name: 'Arial', size: 8 };
  }

  await downloadWorkbook(wb, opts.filename);
}

function customerLabel(label: string, value?: string | null) {
  return `${label}: ${value?.trim() || '—'}`;
}

export async function exportCommercialInvoiceExcel(opts: {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  verifyUrl?: string;
}) {
  const { invoice, items, customer, verifyUrl } = opts;
  const shipmentType = invoice.shipment_type || 'RORO';
  const shipmentMode =
    invoice.container_mode || (invoice.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel');
  const policy = resolveFreightPolicy({
    incoterm: invoice.incoterms,
    shipmentType,
    containerMode: shipmentMode,
  });
  const freight = normalizeFreightAmount(policy, invoice.freight_total);
  const insurance = Number(invoice.insurance_total || 0);
  const other = Number(invoice.other_charges || 0);
  const discount = Number(invoice.discount_total || 0);
  const vehiclesTotal = Number(invoice.subtotal || 0);
  const grand = vehiclesTotal + Number(invoice.tax || 0) + freight + insurance + other - discount;
  await exportTradeDocumentExcel({
    title: 'INVOICE',
    documentNo: invoice.invoice_code,
    issueDate: invoice.issue_date,
    currency: invoice.currency,
    customer,
    shipmentType,
    shipmentMode,
    shipmentTerm: invoice.incoterms,
    portOfLoading: invoice.port_of_loading,
    portOfDischarge: invoice.port_of_discharge,
    lines: items.map(lineFromItem),
    vehiclesTotal,
    freight,
    freightNotes: normalizeFreightNotes(policy, invoice.freight_notes),
    insurance,
    other,
    discount,
    grandTotal: grand,
    verifyUrl,
    notes: invoice.notes,
    filename: `${invoice.invoice_code}_Invoice.xlsx`,
    showDeposit: true,
  });
}

export async function exportQuotationExcel(opts: {
  quotation: Quotation;
  items: TradeLine[];
  customer?: Customer | null;
  verifyUrl?: string;
}) {
  const { quotation, items, customer, verifyUrl } = opts;
  const term = quotation.price_type === 'CNF' ? 'C&F' : quotation.price_type;
  const policy = resolveFreightPolicy({
    incoterm: term,
    shipmentType: 'RORO',
    containerMode: 'RORO Vessel',
  });
  const freight = normalizeFreightAmount(policy, quotation.freight);
  const insurance = Number(quotation.insurance || 0);
  const other = Number(quotation.other_fees || 0);
  const vehiclesTotal = Number(quotation.subtotal || 0);
  const grand = vehiclesTotal + freight + insurance + other;
  await exportTradeDocumentExcel({
    title: 'QUOTATION',
    documentNo: quotation.quotation_code,
    issueDate: quotation.created_at?.slice(0, 10) || '',
    currency: quotation.currency,
    customer,
    shipmentTerm: term,
    shipmentType: 'RORO',
    shipmentMode: 'RORO Vessel',
    lines: items.map(lineFromItem),
    vehiclesTotal,
    freight,
    freightNotes: normalizeFreightNotes(policy, quotation.freight_notes),
    insurance,
    other,
    grandTotal: grand,
    verifyUrl,
    notes: quotation.notes,
    filename: `${quotation.quotation_code}_Quotation.xlsx`,
    showDeposit: false,
  });
}
