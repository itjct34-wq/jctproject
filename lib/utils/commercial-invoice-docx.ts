import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { JCT_OFFICIAL, extractChassis, formatDepositRatio, formatMoney, letterheadName } from '@/lib/jct-official';
import type { Customer, Invoice, InvoiceItem, Vehicle } from '@/lib/types';
import {
  applyFreightToVehicleLines,
  filterFreightChargeLines,
  normalizeFreightNotes,
  resolveDocumentFreightDisplay,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';

const RED = 'C4161C';
const thin = { style: BorderStyle.SINGLE, size: 4, color: '666666' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function cell(text: string, opts?: { bold?: boolean; fill?: string; color?: string; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new TableCell({
    borders,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts?.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: text || ' ',
            bold: opts?.bold,
            color: opts?.color || '000000',
            size: 16,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

export async function exportCommercialInvoiceDocx(opts: {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number'>[];
}) {
  const { invoice, items, customer, vehicles = [] } = opts;
  const freightPolicy = resolveFreightPolicy({
    incoterm: invoice.incoterms,
    shipmentType: invoice.shipment_type || 'RORO',
    containerMode:
      invoice.container_mode ||
      (invoice.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel'),
  });
  const freightDisplay = resolveDocumentFreightDisplay(freightPolicy, invoice.freight_total);
  const freight = freightDisplay.documentFreight;
  const freightNotes =
    normalizeFreightNotes(freightPolicy, invoice.freight_notes) || freightPolicy.defaultFreightLabel;
  const showFreight = freightDisplay.showFreightBlock;
  const vehiclesTotalLabel = showFreight ? 'Vehicles total' : 'Total';
  const vehiclesBase = Number(invoice.subtotal || 0);
  const vehiclesTotal = vehiclesBase + freightDisplay.vehiclesFreightAddon;
  const grand =
    vehiclesTotal +
    Number(invoice.tax || 0) +
    freight +
    Number(invoice.insurance_total || 0) +
    Number(invoice.other_charges || 0) -
    Number(invoice.discount_total || 0);

  const mappedItems = (items.length ? items : []).map((item) => ({
    ...item,
    quantity: item.quantity,
    unit_price: Number(item.unit_price || 0),
    line_total: Number(item.line_total || 0) || Number(item.quantity || 1) * Number(item.unit_price || 0),
  }));
  const baseItems = filterFreightChargeLines(mappedItems, freightPolicy);
  const pricedItems = applyFreightToVehicleLines(baseItems, freightDisplay.vehiclesFreightAddon);

  const vehicleRows = pricedItems.map((item) => {
    const vehicle = vehicles.find((v) => v.id === item.vehicle_id);
    const chassis = vehicle?.chassis_number || extractChassis(item.description) || '—';
    const stock = vehicle
      ? [vehicle.stock_number, vehicle.make, vehicle.model].filter(Boolean).join(' · ')
      : item.description;
    const depositBaseUnit = Number(item.unit_price);
    return new TableRow({
      children: [
        cell(chassis),
        cell(stock),
        cell(formatDepositRatio(item.discount, depositBaseUnit), { align: AlignmentType.CENTER }),
        cell(formatMoney(item.line_total, invoice.currency), { align: AlignmentType.RIGHT }),
      ],
    });
  });

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: letterheadName(), bold: true, color: RED, size: 28, font: 'Arial' }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'INVOICE', bold: true, color: RED, size: 40, font: 'Arial' })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: invoice.invoice_code, bold: true, size: 22, font: 'Arial' })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell('BILL TO', { bold: true, fill: RED, color: 'FFFFFF' }),
                  cell('BILL FROM', { bold: true, fill: RED, color: 'FFFFFF' }),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    [
                      customer?.customer_code,
                      customer?.full_name,
                      customer?.address_line1,
                      customer?.phone,
                      customer?.email,
                    ]
                      .filter(Boolean)
                      .join('\n')
                  ),
                  cell(
                    [
                      letterheadName(),
                      JCT_OFFICIAL.address,
                      `Fax: ${JCT_OFFICIAL.fax}`,
                      `Phone: ${JCT_OFFICIAL.phone}`,
                      JCT_OFFICIAL.email,
                      JCT_OFFICIAL.website,
                    ].join('\n')
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 200 }, children: [] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell('Type', { fill: 'F3F3F3', bold: true }),
                  cell(invoice.shipment_type || 'RORO'),
                  cell('Mode', { fill: 'F3F3F3', bold: true }),
                  cell(invoice.container_mode || 'RORO Vessel'),
                ],
              }),
              new TableRow({
                children: [
                  cell('Term', { fill: 'F3F3F3', bold: true }),
                  cell(invoice.incoterms || 'FOB'),
                  cell('POL / POD', { fill: 'F3F3F3', bold: true }),
                  cell(`${invoice.port_of_loading || 'Nagoya, Japan'} / ${invoice.port_of_discharge || '—'}`),
                ],
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: `Total Unit(s): ${items.reduce((s, i) => s + Number(i.quantity || 1), 0) || 1}`, bold: true, size: 18 })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell('CHASSIS NO', { bold: true, fill: RED, color: 'FFFFFF' }),
                  cell('STOCK INFO', { bold: true, fill: RED, color: 'FFFFFF' }),
                  cell('DEPOSIT RATIO', { bold: true, fill: RED, color: 'FFFFFF' }),
                  cell('Total', { bold: true, fill: RED, color: 'FFFFFF' }),
                ],
              }),
              ...vehicleRows,
              ...(showFreight
                ? [
                    new TableRow({
                      children: [
                        cell('VEHICLES TOTAL', { bold: true }),
                        cell(''),
                        cell(''),
                        cell(formatMoney(vehiclesTotal, invoice.currency), {
                          bold: true,
                          align: AlignmentType.RIGHT,
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
          ...(showFreight
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 80 },
                  children: [new TextRun({ text: 'FREIGHT', bold: true, size: 18 })],
                }),
                new Table({
                  width: { size: 9360, type: WidthType.DXA },
                  rows: [
                    new TableRow({
                      children: [
                        cell('Description', { bold: true, fill: RED, color: 'FFFFFF' }),
                        cell('Currency', { bold: true, fill: RED, color: 'FFFFFF' }),
                        cell('Amount', { bold: true, fill: RED, color: 'FFFFFF' }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        cell(freightNotes),
                        cell(invoice.currency),
                        cell(formatMoney(freight, invoice.currency), { align: AlignmentType.RIGHT }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        cell('FREIGHT TOTAL', { bold: true }),
                        cell(''),
                        cell(formatMoney(freight, invoice.currency), { bold: true, align: AlignmentType.RIGHT }),
                      ],
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: 'TOTALS', bold: true, size: 18 })],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: [
              ...(showFreight
                ? [
                    new TableRow({
                      children: [
                        cell(vehiclesTotalLabel),
                        cell(formatMoney(vehiclesTotal, invoice.currency), {
                          align: AlignmentType.RIGHT,
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        cell('Freight'),
                        cell(formatMoney(freight, invoice.currency), { align: AlignmentType.RIGHT }),
                      ],
                    }),
                  ]
                : []),
              new TableRow({
                children: [
                  cell('INVOICE TOTAL', { bold: true, fill: RED, color: 'FFFFFF' }),
                  cell(formatMoney(grand, invoice.currency), { bold: true, fill: RED, color: 'FFFFFF', align: AlignmentType.RIGHT }),
                ],
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 240 },
            children: [new TextRun({ text: 'BANKING DETAILS', bold: true, color: RED, size: 20 })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Beneficiary Bank (Account with Institution) Bank Name: ${JCT_OFFICIAL.bank.name} Branch Name: ${JCT_OFFICIAL.bank.branch} Bank Address: ${JCT_OFFICIAL.bank.address} SWIFT Code / BIC: ${JCT_OFFICIAL.bank.swift}`,
                size: 16,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Beneficiary Information Account Number: ${JCT_OFFICIAL.bank.account} Beneficiary Name: ${letterheadName()} Beneficiary Address: ${JCT_OFFICIAL.bank.beneficiaryAddress}`,
                size: 16,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Intermediary Bank Bank Name: ${JCT_OFFICIAL.bank.intermediaryName} SWIFT Code / BIC: ${JCT_OFFICIAL.bank.intermediarySwift} Intermediary Bank address: ${JCT_OFFICIAL.bank.intermediaryAddress}`,
                size: 16,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: `${JCT_OFFICIAL.directorTitle}: ${JCT_OFFICIAL.director}`, bold: true })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoice_code}_Commercial_Invoice.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
