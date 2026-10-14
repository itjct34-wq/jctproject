import type { ReactNode } from 'react';
import type { Customer, Vehicle } from '@/lib/types';
import { JCT_OFFICIAL, extractChassis, formatMoney } from '@/lib/jct-official';
import { JctHanko } from './jct-hanko';
import { PaymentInformationNotice } from './payment-information-notice';
import { InvoiceQRCode } from '@/components/invoices/qr-code';

export type TradeLine = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount?: number;
  vehicle_id?: string | null;
};

type Props = {
  kind: 'invoice' | 'quotation';
  title: string;
  documentNo: string;
  issueDate: string;
  validDate?: string | null;
  dueDate?: string | null;
  salesAgent?: string | null;
  customer?: Customer | null;
  currency: string;
  shipmentType?: string | null;
  shipmentMode?: string | null;
  shipmentTerm?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  lines: TradeLine[];
  vehicles?: Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number'>[];
  freightTotal?: number;
  grandTotal: number;
  notes?: string | null;
  verificationUrl?: string;
  showQr?: boolean;
  includeBankNotice?: boolean;
};

function customerAddress(customer?: Customer | null) {
  if (!customer) return '';
  return [customer.address_line1, customer.address_line2, [customer.city, customer.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(', ');
}

function MetaRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <tr>
      <td className={`w-[28%] bg-[#f3f3f3] px-2 py-1.5 font-medium ${last ? '' : 'border-b border-gray-300'}`}>{label}</td>
      <td className={`px-2 py-1.5 ${last ? '' : 'border-b border-gray-300'}`}>{value || '—'}</td>
    </tr>
  );
}

export function OfficialTradeDocument({
  kind,
  title,
  documentNo,
  issueDate,
  validDate,
  dueDate,
  salesAgent,
  customer,
  currency,
  shipmentType,
  shipmentMode,
  shipmentTerm,
  portOfLoading,
  portOfDischarge,
  lines,
  vehicles = [],
  freightTotal = 0,
  grandTotal,
  notes,
  verificationUrl,
  showQr = true,
  includeBankNotice = false,
}: Props) {
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0) || (lines.length ? 1 : 0);
  const addr = customerAddress(customer);

  return (
    <div className="invoice-print-root bg-white text-black max-w-[210mm] mx-auto text-[11px] leading-snug">
      <div className="p-5 print:p-0">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={JCT_OFFICIAL.logo} alt="JCT" className="h-[70px] w-auto object-contain" />
          </div>
          <div className="min-w-[240px] rounded-full bg-gradient-to-b from-[#d31c28] to-[#8a1218] px-8 py-3 text-center shadow-sm">
            <h1 className="text-2xl font-black tracking-[0.18em] text-white">{title}</h1>
          </div>
        </div>

        <table className="w-full border-collapse border border-gray-400">
          <thead>
            <tr className="bg-[#c4161c] text-white">
              <th className="w-1/2 border border-gray-400 px-3 py-1.5 text-left text-sm font-bold">BILL TO</th>
              <th className="w-1/2 border border-gray-400 px-3 py-1.5 text-left text-sm font-bold">BILL FROM</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-gray-400 p-0">
                <table className="w-full border-collapse">
                  <tbody>
                    <MetaRow label="Customer ID" value={customer?.customer_code} />
                    <MetaRow label="Customer Full Name" value={customer?.full_name} />
                    <MetaRow label="Customer Full Address" value={addr} />
                    <MetaRow label="Customer Phone" value={customer?.phone} />
                    <MetaRow label="Customer Email" value={customer?.email} />
                    <MetaRow label="Consignee Full Name" value={customer?.company_name || customer?.full_name} />
                    <MetaRow label="Consignee Full Address" value={addr} />
                    <MetaRow label="Consignee Phone" value={customer?.phone} />
                    <MetaRow label="Consignee Email" value={customer?.email} last />
                  </tbody>
                </table>
              </td>
              <td className="border border-gray-400 p-0">
                <table className="w-full border-collapse">
                  <tbody>
                    <MetaRow label="Company Name" value={JCT_OFFICIAL.shortName} />
                    <MetaRow label="Address" value={JCT_OFFICIAL.address} />
                    <MetaRow label="Fax" value={JCT_OFFICIAL.fax} />
                    <MetaRow label="Phone" value={JCT_OFFICIAL.phone} />
                    <MetaRow label="Email" value={JCT_OFFICIAL.email} />
                    <MetaRow label="Website" value={JCT_OFFICIAL.website} />
                    <MetaRow label={kind === 'invoice' ? 'Invoice Number' : 'Quotation Number'} value={documentNo} />
                    <MetaRow label={kind === 'invoice' ? 'Invoice Issue Date' : 'Issue Date'} value={issueDate} />
                    <MetaRow
                      label={kind === 'invoice' ? 'Invoice Valid Date' : 'Valid Until'}
                      value={validDate || '—'}
                    />
                    {kind === 'invoice' ? (
                      <MetaRow label="Payment Due Date" value={dueDate || '—'} />
                    ) : (
                      <MetaRow label="Price Terms" value={shipmentTerm || '—'} />
                    )}
                    <MetaRow label="Sales Agent" value={salesAgent} last />
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mt-3 w-full border-collapse border border-gray-400">
          <tbody>
            <tr>
              <td className="w-[18%] border border-gray-400 bg-[#c4161c] px-2 py-2 text-center font-bold text-white">
                SHIPPING INFO
              </td>
              <td className="border border-gray-400 px-2 py-2">
                <p className="text-[9px] uppercase text-gray-500">Type</p>
                <p className="font-semibold">{shipmentType || 'RORO'}</p>
              </td>
              <td className="border border-gray-400 px-2 py-2">
                <p className="text-[9px] uppercase text-gray-500">Mode (RORO / Container)</p>
                <p className="font-semibold">{shipmentMode || (shipmentType === 'Container' ? '40ft Container' : 'RORO Vessel')}</p>
              </td>
              <td className="border border-gray-400 bg-gray-100 px-2 py-2">
                <p className="text-[9px] uppercase text-gray-500">Shipment Term</p>
                <p className="font-semibold">{shipmentTerm || 'FOB'}</p>
              </td>
            </tr>
            <tr>
              <td className="border border-gray-400 bg-gray-100 px-2 py-2 font-semibold">Ports</td>
              <td className="border border-gray-400 px-2 py-2" colSpan={2}>
                <span className="text-gray-500">POL</span> {portOfLoading || 'Nagoya, Japan'}
              </td>
              <td className="border border-gray-400 px-2 py-2">
                <span className="text-gray-500">POD</span> {portOfDischarge || '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 font-semibold">Total Unit(s): {units}</p>

        <table className="w-full border-collapse border border-gray-400">
          <thead>
            <tr className="bg-[#c4161c] text-white">
              <th className="border border-gray-300 px-2 py-1.5 text-left">CHASSIS NO</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left">STOCK INFO</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Freight Charges</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center">DEPOSIT RATIO</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Vehicle Cost</th>
            </tr>
          </thead>
          <tbody>
            {(lines.length ? lines : [{ description: '—', quantity: 1, unit_price: 0, line_total: 0 }]).map((line, idx) => {
              const vehicle = vehicles.find((v) => v.id === line.vehicle_id);
              const chassis = vehicle?.chassis_number || extractChassis(line.description) || '';
              const stock =
                vehicle
                  ? [vehicle.stock_number, vehicle.make, vehicle.model].filter(Boolean).join(' · ')
                  : line.description;
              const deposit =
                line.discount && line.unit_price
                  ? `${Math.round((Number(line.discount) / Number(line.unit_price)) * 100)}%`
                  : idx === 0 && kind === 'quotation'
                    ? 'As agreed'
                    : '—';
              return (
                <tr key={idx}>
                  <td className="border border-gray-400 px-2 py-2 font-mono">{chassis || '—'}</td>
                  <td className="border border-gray-400 px-2 py-2 whitespace-pre-line">{stock}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right">
                    {idx === 0 && freightTotal ? formatMoney(freightTotal, currency) : ''}
                  </td>
                  <td className="border border-gray-400 px-2 py-2 text-center">{deposit}</td>
                  <td className="border border-gray-400 px-2 py-2 text-right">{formatMoney(line.unit_price, currency)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={4} className="border border-gray-400 px-2 py-2 text-right font-bold">
                TOTAL
              </td>
              <td className="border border-gray-400 px-2 py-2 text-right font-bold">{formatMoney(grandTotal, currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="mt-3 w-full border-collapse border border-gray-400">
          <thead>
            <tr className="bg-[#c4161c] text-white">
              <th className="w-1/2 border border-gray-400 px-3 py-1.5 text-left font-bold">BANKING DETAILS</th>
              <th className="w-1/2 border border-gray-400 px-3 py-1.5 text-left font-bold">Beneficiary Information</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-gray-400 px-3 py-3">
                <p className="mb-1 font-semibold">Beneficiary Bank (Account with Institution) Information</p>
                <p>Name: {JCT_OFFICIAL.bank.name}</p>
                <p>Branch Name: {JCT_OFFICIAL.bank.branch}</p>
                <p>Bank Address: {JCT_OFFICIAL.bank.address}</p>
                <p>SWIFT Code / BIC: {JCT_OFFICIAL.bank.swift}</p>
              </td>
              <td className="border border-gray-400 px-3 py-3">
                <p>Account Number: {JCT_OFFICIAL.bank.account}</p>
                <p>Beneficiary Name: {JCT_OFFICIAL.bank.beneficiary}</p>
                <p>Beneficiary Address: {JCT_OFFICIAL.bank.beneficiaryAddress}</p>
                <p className="mt-2 font-semibold">Intermediary Bank</p>
                <p>SWIFT Code / BIC: {JCT_OFFICIAL.bank.intermediarySwift}</p>
                <p>Bank Name: {JCT_OFFICIAL.bank.intermediaryName}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {notes && <p className="mt-2 text-gray-700">Notes: {notes}</p>}

        <div className="mt-3 flex items-stretch gap-3">
          <div className="flex-1 border border-gray-400">
            <div className="px-3 py-4 text-center">
              <p className="text-sm font-black">{JCT_OFFICIAL.legalName}</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <div>
                  <p className="text-[10px]">{JCT_OFFICIAL.directorTitle}</p>
                  <p className="text-lg font-black tracking-wide">{JCT_OFFICIAL.director}</p>
                  <p className="mt-1 text-[9px] text-gray-600">{JCT_OFFICIAL.address}</p>
                  <p className="text-[9px] text-gray-600">PHONE: +81 52-717-4476</p>
                </div>
                <JctHanko />
              </div>
            </div>
            <div className="border-t border-gray-400 py-2 text-center text-[10px] font-bold tracking-wide">
              SIGNATURE OF AUTHORISED PERSON
            </div>
          </div>
          {showQr && verificationUrl && (
            <div className="flex w-[120px] flex-col items-center justify-center border border-gray-400 p-2">
              <InvoiceQRCode value={verificationUrl} size={88} />
              <p className="mt-1 text-center text-[8px] text-gray-500">Scan to verify</p>
            </div>
          )}
        </div>
      </div>

      {includeBankNotice && (
        <PaymentInformationNotice
          customerName={customer?.full_name}
          reference={documentNo}
          issueDate={issueDate}
        />
      )}
    </div>
  );
}
