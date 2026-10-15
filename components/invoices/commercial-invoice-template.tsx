'use client';

import { format } from 'date-fns';
import type { Invoice, InvoiceItem, Customer, Vehicle } from '@/lib/types';
import { OfficialTradeDocument } from '@/components/documents/official-trade-document';
import { decodeInvoiceVehicle } from '@/lib/jct-official';
import { buildVerifyUrl } from './qr-code';

type Props = {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  company?: { name?: string; address?: string; phone?: string; email?: string };
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number' | 'color' | 'model_year' | 'transmission'>[];
  salesAgent?: string | null;
  showQr?: boolean;
  includeBankNotice?: boolean;
  variant?: 'commercial' | 'auction_deposit';
};

export function CommercialInvoiceTemplate({
  invoice,
  items,
  customer,
  vehicles,
  salesAgent,
  showQr = true,
  includeBankNotice = false,
  variant = 'commercial',
}: Props) {
  const vehiclesTotal = Number(invoice.subtotal || 0);
  const freight = Number(invoice.freight_total || 0);
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
      issueDate={format(new Date(invoice.issue_date), 'yyyy-MM-dd')}
      validDate={invoice.due_date ? format(new Date(invoice.due_date), 'yyyy-MM-dd') : null}
      dueDate={invoice.due_date ? format(new Date(invoice.due_date), 'yyyy-MM-dd') : null}
      salesAgent={salesAgent}
      customer={customer}
      currency={invoice.currency}
      shipmentType={invoice.shipment_type || 'RORO'}
      shipmentMode={invoice.container_mode || (invoice.shipment_type === 'Container' ? '40ft Container' : 'RORO Vessel')}
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
      freightNotes={invoice.freight_notes}
      insuranceAmount={insurance}
      otherAmount={other}
      discountAmount={discount}
      grandTotal={grand}
      notes={invoice.notes}
      verificationUrl={verifyUrl || undefined}
      showQr={showQr}
      includeBankNotice={includeBankNotice}
      depositMode={variant === 'auction_deposit' ? 'amount' : 'ratio'}
    />
  );
}
