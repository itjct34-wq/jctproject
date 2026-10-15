'use client';

import { format } from 'date-fns';
import type { Quotation, Customer, Vehicle } from '@/lib/types';
import { OfficialTradeDocument, type TradeLine } from '@/components/documents/official-trade-document';
import { decodeInvoiceVehicle } from '@/lib/jct-official';

type Props = {
  quotation: Quotation;
  items?: TradeLine[];
  customer?: Customer | null;
  company?: { name?: string; address?: string; phone?: string; email?: string };
  verificationUrl?: string;
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number' | 'color' | 'model_year' | 'transmission'>[];
  salesAgent?: string | null;
  layoutVariant?: 'standard' | 'breakdown';
};

export function CommercialQuotationTemplate({
  quotation,
  items = [],
  customer,
  verificationUrl,
  vehicles,
  salesAgent,
  layoutVariant = 'standard',
}: Props) {
  const insurance = Number(quotation.insurance || 0);
  const other = Number(quotation.other_fees || 0);
  const subtotal = Number(quotation.subtotal || 0);
  const freight = Number(quotation.freight || 0);
  const grand = Number(quotation.total || subtotal + freight + insurance + other);

  const lines: TradeLine[] =
    items.length > 0
      ? items.map((item) => {
          const bits = decodeInvoiceVehicle(item.description);
          return {
            ...item,
            chassis_number: item.chassis_number || bits.chassis_number,
            stock_number: item.stock_number || bits.stock_number,
            make: item.make || bits.make,
            model: item.model || bits.model,
            colour: item.colour || bits.colour,
            year: item.year || bits.year,
            engine: item.engine || bits.engine,
            transmission: item.transmission || bits.transmission,
          };
        })
      : [
          {
            description: `${quotation.price_type} vehicle quotation`,
            quantity: 1,
            unit_price: subtotal,
            line_total: subtotal,
          },
        ];

  return (
    <OfficialTradeDocument
      kind="quotation"
      title="QUOTATION"
      documentNo={quotation.quotation_code}
      issueDate={format(new Date(quotation.created_at), 'yyyy-MM-dd')}
      validDate={quotation.valid_until ? format(new Date(quotation.valid_until), 'yyyy-MM-dd') : null}
      salesAgent={salesAgent}
      customer={customer}
      currency={quotation.currency}
      shipmentType="RORO"
      shipmentMode="RORO Vessel"
      shipmentTerm={quotation.price_type}
      lines={lines}
      vehicles={vehicles}
      vehiclesTotal={subtotal}
      freightAmount={freight}
      freightNotes={quotation.freight_notes}
      insuranceAmount={insurance}
      otherAmount={other}
      grandTotal={grand}
      notes={quotation.notes}
      verificationUrl={verificationUrl}
      layoutVariant={layoutVariant}
    />
  );
}
