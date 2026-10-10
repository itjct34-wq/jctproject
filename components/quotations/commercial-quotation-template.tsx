'use client';

import { format } from 'date-fns';
import type { Quotation, Customer } from '@/lib/types';

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Props = {
  quotation: Quotation;
  items?: LineItem[];
  customer?: Customer | null;
  company?: { name?: string; address?: string; phone?: string; email?: string };
};

export function CommercialQuotationTemplate({
  quotation,
  items = [],
  customer,
  company,
}: Props) {
  const companyName = company?.name || 'Japan Circular Trading';
  const companyAddress = company?.address || '2-505-101 Daitoro, Nakagawa-ku, Nagoya, Aichi 454-0943, Japan';
  const companyPhone = company?.phone || '+81 70-2241-6356';
  const companyEmail = company?.email || 'info@japancirculartrading.com';

  const freight = Number(quotation.freight || 0);
  const insurance = Number(quotation.insurance || 0);
  const other = Number(quotation.other_fees || 0);
  const subtotal = Number(quotation.subtotal || 0);
  const grand = Number(quotation.total || subtotal + freight + insurance + other);

  const defaultItems: LineItem[] =
    items.length > 0
      ? items
      : [
          {
            description: `${quotation.price_type} vehicle quotation`,
            quantity: 1,
            unit_price: subtotal,
            line_total: subtotal,
          },
        ];

  return (
    <div className="invoice-print-root bg-white text-black max-w-[210mm] mx-auto p-6 print:p-4 text-sm">
      <div className="flex justify-between items-start border-b-4 border-red-600 pb-4 mb-4">
        <div className="flex gap-3 items-start">
          <img
            src="/images/705607377_122127683871150897_4165866362055650133_n-removebg-preview.png"
            alt="JCT"
            className="w-14 h-14 object-contain rounded-lg border border-gray-200 bg-white p-0.5 shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-red-600 tracking-tight">{companyName}</h1>
            <p className="text-xs italic text-gray-600 mt-0.5">Car Importing & Exporting Xpert</p>
            <p className="text-[11px] text-gray-600 mt-2">{companyAddress}</p>
            <p className="text-[11px] text-gray-600">Tel: {companyPhone} &nbsp;|&nbsp; {companyEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-black tracking-wider">QUOTATION</h2>
          <p className="text-xs font-semibold text-red-600 uppercase mt-1">{quotation.price_type} Terms</p>
          <p className="text-sm font-mono font-bold mt-2">{quotation.quotation_code}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
        {[
          ['Date', format(new Date(quotation.created_at), 'yyyy-MM-dd')],
          ['Currency', quotation.currency],
          ['Incoterms', quotation.price_type],
          ['Status', quotation.status],
        ].map(([l, v]) => (
          <div key={l} className="bg-gray-50 border p-2 rounded">
            <p className="text-gray-500 uppercase text-[10px]">{l}</p>
            <p className="font-semibold capitalize">{v}</p>
          </div>
        ))}
      </div>

      {quotation.valid_until && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2">
          <span className="font-semibold text-amber-800">Valid until: </span>
          {format(new Date(quotation.valid_until), 'yyyy-MM-dd')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border rounded overflow-hidden">
          <div className="bg-red-600 text-white text-[10px] font-bold uppercase px-3 py-1">Seller</div>
          <div className="p-3 text-xs space-y-0.5">
            <p className="font-bold">{companyName}</p>
            <p>{companyAddress}</p>
            <p>{companyPhone}</p>
            <p>{companyEmail}</p>
          </div>
        </div>
        <div className="border rounded overflow-hidden">
          <div className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-3 py-1">Buyer / Consignee</div>
          <div className="p-3 text-xs space-y-0.5">
            <p className="font-bold">{customer?.full_name || '—'}</p>
            {customer?.address_line1 && <p>{customer.address_line1}</p>}
            {(customer?.city || customer?.country) && (
              <p>{[customer.city, customer.country].filter(Boolean).join(', ')}</p>
            )}
            {customer?.phone && <p>{customer.phone}</p>}
            {customer?.email && <p>{customer.email}</p>}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5">
        Quotation line items
      </div>
      <table className="w-full text-xs border-collapse mb-3">
        <thead>
          <tr className="bg-red-600 text-white">
            <th className="border border-red-700 px-2 py-1.5 text-left w-8">#</th>
            <th className="border border-red-700 px-2 py-1.5 text-left">Description</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-14">Qty</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-24">Unit Price</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {defaultItems.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
              <td className="border px-2 py-1.5 whitespace-pre-line">{item.description}</td>
              <td className="border px-2 py-1.5 text-right">{item.quantity}</td>
              <td className="border px-2 py-1.5 text-right">
                {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              <td className="border px-2 py-1.5 text-right font-medium">
                {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-4">
        <div className="w-72 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>
              {quotation.currency}{' '}
              {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          {freight > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Freight</span>
              <span>
                {quotation.currency}{' '}
                {freight.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {insurance > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Insurance</span>
              <span>
                {quotation.currency}{' '}
                {insurance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {other > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Other fees</span>
              <span>
                {quotation.currency}{' '}
                {other.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex justify-between bg-red-600 text-white font-bold px-3 py-2 rounded mt-1">
            <span>GRAND TOTAL</span>
            <span>
              {quotation.currency}{' '}
              {grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {quotation.notes && (
        <div className="text-[11px] text-gray-600 border-t pt-2 mb-4">
          <span className="font-semibold">Notes: </span>
          {quotation.notes}
        </div>
      )}

      <div className="text-[10px] text-gray-500 border-t pt-2 space-y-0.5">
        <p>1. This quotation is not a final invoice. Prices subject to stock availability.</p>
        <p>2. FOB / C&F / CIF terms as selected. Final shipping costs confirmed at booking.</p>
        <p>3. Payment terms: 100% T/T in advance or LC at sight unless otherwise agreed.</p>
        <p>4. Governed by Japanese law. Disputes resolved in Nagoya, Japan.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
        <div>
          <p className="text-gray-500">For and on behalf of</p>
          <p className="font-bold text-red-600 mt-1">{companyName}</p>
          <div className="border-t border-gray-400 mt-10 pt-1 text-gray-500 italic">Authorized Signature / Stamp</div>
        </div>
        <div>
          <p className="text-gray-500">Accepted by Buyer</p>
          <div className="border-t border-gray-400 mt-16 pt-1 text-gray-500 italic">Buyer Signature / Company Stamp</div>
        </div>
      </div>
    </div>
  );
}
