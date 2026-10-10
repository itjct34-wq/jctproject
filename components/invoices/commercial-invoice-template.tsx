'use client';

import { format } from 'date-fns';
import type { Invoice, InvoiceItem, Customer } from '@/lib/types';
import { InvoiceQRCode, buildVerifyUrl } from './qr-code';

type Props = {
  invoice: Invoice;
  items: InvoiceItem[];
  customer?: Customer | null;
  company?: { name?: string; address?: string; phone?: string; email?: string };
};

const typeLabels: Record<string, string> = {
  proforma: 'Proforma Invoice',
  commercial: 'Commercial Invoice',
  credit_note: 'Credit Note',
};

export function CommercialInvoiceTemplate({ invoice, items, customer, company }: Props) {
  const companyName = company?.name || 'Japan Circular Trading';
  const companyAddress = company?.address || '2-505-101 Daitoro, Nakagawa-ku, Nagoya, Aichi 454-0943, Japan';
  const companyPhone = company?.phone || '+81 70-2241-6356';
  const companyEmail = company?.email || 'info@japancirculartrading.com';
  const verifyUrl = invoice.verification_token ? buildVerifyUrl(invoice.verification_token) : '';
  const freight = Number(invoice.freight_total || 0);
  const insurance = Number(invoice.insurance_total || 0);
  const other = Number(invoice.other_charges || 0);
  const discount = Number(invoice.discount_total || 0);
  const grand = Number(invoice.subtotal || 0) + Number(invoice.tax || 0) + freight + insurance + other - discount;

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
          <h2 className="text-3xl font-black tracking-wider">INVOICE</h2>
          <p className="text-xs font-semibold text-red-600 uppercase mt-1">{typeLabels[invoice.invoice_type] || 'Commercial Invoice'}</p>
          <p className="text-sm font-mono font-bold mt-2">{invoice.invoice_code}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
        {[ ['Date', format(new Date(invoice.issue_date), 'yyyy-MM-dd')], ['Currency', invoice.currency], ['Incoterms', invoice.incoterms || 'FOB'], ['Status', invoice.payment_status] ].map(([l, v]) => (
          <div key={l} className="bg-gray-50 border p-2 rounded">
            <p className="text-gray-500 uppercase text-[10px]">{l}</p>
            <p className="font-semibold capitalize">{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5">Shipping Terms</div>
      <div className="grid grid-cols-5 gap-px bg-gray-200 border border-gray-200 mb-4 text-xs">
        {[ ['Type', invoice.shipment_type || 'RORO'], ['Mode', invoice.container_mode || 'RORO Vessel'], ['POL', invoice.port_of_loading || 'Nagoya, Japan'], ['POD', invoice.port_of_discharge || '—'], ['Vessel / BL', invoice.vessel_name || invoice.bl_number || '—'] ].map(([l, v]) => (
          <div key={l} className="bg-white p-2">
            <p className="text-gray-500 text-[10px] uppercase">{l}</p>
            <p className="font-medium">{v}</p>
          </div>
        ))}
      </div>

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
            {(customer?.city || customer?.country) && <p>{[customer.city, customer.country].filter(Boolean).join(', ')}</p>}
            {customer?.phone && <p>{customer.phone}</p>}
            {customer?.email && <p>{customer.email}</p>}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5">Vehicle / Cargo Details</div>
      <table className="w-full text-xs border-collapse mb-3">
        <thead>
          <tr className="bg-red-600 text-white">
            <th className="border border-red-700 px-2 py-1.5 text-left w-8">#</th>
            <th className="border border-red-700 px-2 py-1.5 text-left">Description</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-14">Qty</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-24">Unit Price</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-20">Disc</th>
            <th className="border border-red-700 px-2 py-1.5 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>
              <td className="border px-2 py-1.5 whitespace-pre-line">{item.description}</td>
              <td className="border px-2 py-1.5 text-right">{item.quantity}</td>
              <td className="border px-2 py-1.5 text-right">{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border px-2 py-1.5 text-right">{Number(item.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border px-2 py-1.5 text-right font-medium">{Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={6} className="border px-2 py-4 text-center text-gray-400">No line items</td></tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end mb-4">
        <div className="w-72 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{invoice.currency} {Number(invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          {Number(invoice.tax) > 0 && <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{invoice.currency} {Number(invoice.tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          {freight > 0 && <div className="flex justify-between"><span className="text-gray-600">Freight</span><span>{invoice.currency} {freight.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          {insurance > 0 && <div className="flex justify-between"><span className="text-gray-600">Insurance</span><span>{invoice.currency} {insurance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          {other > 0 && <div className="flex justify-between"><span className="text-gray-600">Other charges</span><span>{invoice.currency} {other.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          {discount > 0 && <div className="flex justify-between"><span className="text-gray-600">Discount</span><span>-{invoice.currency} {discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
          <div className="flex justify-between bg-red-600 text-white font-bold px-3 py-2 rounded mt-1">
            <span>GRAND TOTAL</span>
            <span>{invoice.currency} {grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 border rounded overflow-hidden">
          <div className="bg-zinc-900 text-white text-[10px] font-bold uppercase px-3 py-1">Payment Details</div>
          <div className="p-3 text-xs space-y-1">
            <p><span className="text-gray-500">Terms: </span>{invoice.payment_terms || '100% T/T in advance / LC at sight'}</p>
            {invoice.bank_details ? <pre className="whitespace-pre-wrap font-sans text-[11px]">{invoice.bank_details}</pre> : <p className="text-gray-500">Bank details as per company settings.</p>}
          </div>
        </div>
        <div className="border rounded flex flex-col items-center justify-center p-3">
          {verifyUrl ? (
            <>
              <InvoiceQRCode value={verifyUrl} size={100} />
              <p className="text-[9px] text-gray-500 mt-2 text-center leading-tight">Scan to verify authenticity</p>
            </>
          ) : (
            <p className="text-[10px] text-gray-400">No verification token</p>
          )}
        </div>
      </div>

      {invoice.notes && <div className="text-[11px] text-gray-600 border-t pt-2 mb-4"><span className="font-semibold">Notes: </span>{invoice.notes}</div>}

      <div className="text-[10px] text-gray-500 border-t pt-2 space-y-0.5">
        <p>1. Vehicles sold as-is. Buyer may arrange pre-shipment inspection.</p>
        <p>2. Title & risk transfer per selected Incoterms (FOB / C&F / CIF).</p>
        <p>3. Full payment required before release of original documents.</p>
        <p>4. Governed by Japanese law. Disputes resolved in Nagoya, Japan.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
        <div>
          <p className="text-gray-500">For and on behalf of</p>
          <p className="font-bold text-red-600 mt-1">{companyName}</p>
          <div className="border-t border-gray-400 mt-10 pt-1 text-gray-500 italic">Authorized Signature / Stamp</div>
        </div>
        <div>
          <p className="text-gray-500">Received & Acknowledged by Buyer</p>
          <div className="border-t border-gray-400 mt-16 pt-1 text-gray-500 italic">Buyer Signature / Company Stamp</div>
        </div>
      </div>
    </div>
  );
}
