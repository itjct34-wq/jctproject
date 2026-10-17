'use client';

import type { Invoice, InvoiceItem, Customer, Vehicle } from '@/lib/types';
import { OfficialTradeDocument } from '@/components/documents/official-trade-document';
import { decodeInvoiceVehicle, type CompanyLetterheadSettings } from '@/lib/jct-official';
import {
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';
import { buildVerifyUrl } from './qr-code';

/** Calendar date (yyyy-MM-dd) from invoice fields — no timezone shift, no print override. */
function invoiceCalendarDate(value?: string | null) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(value).slice(0, 10);
}

type Props = {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  company?: CompanyLetterheadSettings | { name?: string; address?: string; phone?: string; email?: string } | null;
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number' | 'color' | 'model_year' | 'transmission'>[];
  salesAgent?: string | null;
  showQr?: boolean;
  variant?: 'commercial' | 'auction_deposit';
};

function toLetterhead(
  company?: Props['company']
): CompanyLetterheadSettings | null {
  if (!company) return null;
  if ('company_name' in company || 'logo_url' in company || 'hanko_url' in company || 'legal_name' in company) {
    return company as CompanyLetterheadSettings;
  }
  const legacy = company as { name?: string };
  return legacy.name ? { company_name: legacy.name } : null;
}

export function CommercialInvoiceTemplate({
  invoice,
  items,
  customer,
  company,
  vehicles,
  salesAgent,
  showQr = true,
  variant = 'commercial',
}: Props) {
  const shipmentType = invoice.shipment_type || 'RORO';
  const shipmentMode =
    invoice.container_mode || (invoice.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel');
  const vehiclesTotal = Number(invoice.subtotal || 0);
  const freightPolicy = resolveFreightPolicy({
    incoterm: invoice.incoterms,
    shipmentType,
    containerMode: shipmentMode,
  });
  const freight = normalizeFreightAmount(freightPolicy, invoice.freight_total);
  const freightNotes = normalizeFreightNotes(freightPolicy, invoice.freight_notes);
  const insurance = Number(invoice.insurance_total || 0);
  const other = Number(invoice.other_charges || 0);
  const discount = Number(invoice.discount_total || 0);
  const grand = vehiclesTotal + Number(invoice.tax || 0) + freight + insurance + other - discount;
  const verifyUrl = invoice.verification_token ? buildVerifyUrl(invoice.verification_token) : '';

  return (
    <OfficialTradeDocument
      kind="invoice"
      title={variant === 'auction_deposit' ? 'AUCTION DEPOSIT INVOICE' : 'INVOICE'}
      documentNo={invoice.invoice_code}
      issueDate={invoiceCalendarDate(invoice.issue_date) || ''}
      validDate={invoiceCalendarDate(invoice.due_date)}
      dueDate={invoiceCalendarDate(invoice.due_date)}
      salesAgent={salesAgent}
      customer={customer}
      currency={invoice.currency}
      shipmentType={shipmentType}
      shipmentMode={shipmentMode}
      shipmentTerm={invoice.incoterms || 'FOB'}
      portOfLoading={invoice.port_of_loading}
      portOfDischarge={invoice.port_of_discharge}
      lines={items.map((item) => {
        const bits = decodeInvoiceVehicle(item.description);
        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          discount: item.discount,
          vehicle_id: item.vehicle_id,
          chassis_number: bits.chassis_number,
          stock_number: bits.stock_number,
          make: bits.make,
          model: bits.model,
          colour: bits.colour,
          year: bits.year,
          engine: bits.engine,
          transmission: bits.transmission,
        };
      })}
      vehicles={vehicles}
      vehiclesTotal={vehiclesTotal}
      freightAmount={freight}
      freightNotes={freightNotes}
      insuranceAmount={insurance}
      otherAmount={other}
      discountAmount={discount}
      grandTotal={grand}
      notes={invoice.notes}
      verificationUrl={verifyUrl || undefined}
      showQr={showQr}
      depositMode={variant === 'auction_deposit' ? 'amount' : 'ratio'}
      logoSize={variant === 'auction_deposit' ? 'auction' : 'invoice'}
      company={toLetterhead(company)}
    />
  );
}
