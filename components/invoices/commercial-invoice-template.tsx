'use client';

import { format } from 'date-fns';
import type { Invoice, InvoiceItem, Customer, Vehicle } from '@/lib/types';
import { OfficialTradeDocument } from '@/components/documents/official-trade-document';
import { buildVerifyUrl } from './qr-code';

type Props = {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  company?: { name?: string; address?: string; phone?: string; email?: string };
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number'>[];
  salesAgent?: string | null;
  showQr?: boolean;
  includeBankNotice?: boolean;
};

export function CommercialInvoiceTemplate({
  invoice,
  items,
  customer,
  vehicles,
  salesAgent,
  showQr = true,
  includeBankNotice = false,
}: Props) {
  const freight = Number(invoice.freight_total || 0);
  const insurance = Number(invoice.insurance_total || 0);
  const other = Number(invoice.other_charges || 0);
  const discount = Number(invoice.discount_total || 0);
  const grand = Number(invoice.subtotal || 0) + Number(invoice.tax || 0) + freight + insurance + other - discount;
  const verifyUrl = invoice.verification_token ? buildVerifyUrl(invoice.verification_token) : '';

  return (
    <OfficialTradeDocument
      kind="invoice"
      title="INVOICE"
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
      lines={items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        discount: item.discount,
        vehicle_id: item.vehicle_id,
      }))}
      vehicles={vehicles}
      freightTotal={freight}
      grandTotal={grand}
      notes={invoice.notes}
      verificationUrl={verifyUrl || undefined}
      showQr={showQr}
      includeBankNotice={includeBankNotice}
    />
  );
}
