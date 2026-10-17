'use client';

import { format } from 'date-fns';
import type { Quotation, Customer, Vehicle } from '@/lib/types';
import { OfficialTradeDocument, type TradeLine } from '@/components/documents/official-trade-document';
import { decodeInvoiceVehicle, type CompanyLetterheadSettings } from '@/lib/jct-official';
import {
  normalizeFreightAmount,
  normalizeFreightNotes,
  resolveFreightPolicy,
} from '@/lib/utils/commercial-freight-rules';

type Props = {
  quotation: Quotation;
  items?: TradeLine[];
  customer?: Customer | null;
  company?: CompanyLetterheadSettings | { name?: string; address?: string; phone?: string; email?: string } | null;
  verificationUrl?: string;
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number' | 'color' | 'model_year' | 'transmission'>[];
  salesAgent?: string | null;
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

export function CommercialQuotationTemplate({
  quotation,
  items = [],
  customer,
  company,
  verificationUrl,
  vehicles,
  salesAgent,
}: Props) {
  const insurance = Number(quotation.insurance || 0);
  const other = Number(quotation.other_fees || 0);
  const subtotal = Number(quotation.subtotal || 0);
  const freightPolicy = resolveFreightPolicy({
    incoterm: quotation.price_type === 'CNF' ? 'C&F' : quotation.price_type,
    shipmentType: 'RORO',
    containerMode: 'RORO Vessel',
  });
  const freight = normalizeFreightAmount(freightPolicy, quotation.freight);
  const freightNotes = normalizeFreightNotes(freightPolicy, quotation.freight_notes);
  const grand = subtotal + freight + insurance + other;

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
      shipmentTerm={quotation.price_type === 'CNF' ? 'C&F' : quotation.price_type}
      portOfDischarge={quotation.port_of_discharge}
      lines={lines}
      vehicles={vehicles}
      vehiclesTotal={subtotal}
      freightAmount={freight}
      freightNotes={freightNotes}
      insuranceAmount={insurance}
      otherAmount={other}
      grandTotal={grand}
      notes={quotation.notes}
      verificationUrl={verificationUrl}
      logoSize="quotation"
      company={toLetterhead(company)}
    />
  );
}
