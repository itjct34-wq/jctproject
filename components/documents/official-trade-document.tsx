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
  grandTotal: number;
  notes?: string | null;
  verificationUrl?: string;
  showQr?: boolean;
  includeBankNotice?: boolean;
};

function customerAddress(customer?: Customer | null) {
  if (!customer) return '—';
  return [customer.address_line1, customer.address_line2, [customer.city, customer.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(', ') || '—';
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[10.5px] font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}

function BankLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[8px] leading-[1.35] text-slate-700">
      <span className="font-semibold text-slate-500">{label}: </span>
      <span className="font-medium text-slate-800">{value}</span>
    </p>
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
  grandTotal,
  notes,
  verificationUrl,
  showQr = true,
  includeBankNotice = false,
}: Props) {
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0) || (lines.length ? 1 : 0);
  const addr = customerAddress(customer);
  const consignee = customer?.company_name || customer?.full_name;
  const mode = shipmentMode || (shipmentType === 'Container' ? '40ft Container' : 'RORO Vessel');

  return (
    <div className="invoice-print-root bg-white text-slate-900 max-w-[210mm] mx-auto">
      <div className="invoice-sheet flex flex-col bg-white p-[8mm] print:p-0">
        <header className="flex items-center justify-between gap-4 border-b-2 border-[#c4161c] pb-3">
          <img
            src={JCT_OFFICIAL.logo}
            alt="JCT Cars Import"
            className="h-[148px] w-auto max-w-[420px] object-contain object-left shrink-0"
          />
          <div className="text-right shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c4161c]">{kind === 'invoice' ? 'Tax invoice' : 'Quotation'}</p>
            <h1 className="text-[26px] font-black leading-none tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 font-mono text-[12px] font-bold text-slate-800">{documentNo}</p>
          </div>
        </header>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5 rounded-md bg-slate-50 px-2.5 py-2">
          <Field label={kind === 'invoice' ? 'Issue date' : 'Date'} value={issueDate} />
          <Field label={kind === 'invoice' ? 'Due date' : 'Valid until'} value={dueDate || validDate} />
          <Field label="Sales agent" value={salesAgent} />
          <Field label="Currency" value={currency} />
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <section className="rounded-md border border-slate-200 p-2.5">
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-[#c4161c]">Bill to</p>
            <p className="text-[12px] font-bold leading-tight">{customer?.full_name || '—'}</p>
            <p className="text-[9px] text-slate-500">{customer?.customer_code}</p>
            <p className="mt-1 text-[10px] leading-snug text-slate-700">{addr}</p>
            <p className="text-[10px] text-slate-700">{[customer?.phone, customer?.email].filter(Boolean).join(' · ') || '—'}</p>
            {consignee && consignee !== customer?.full_name && (
              <p className="mt-1 text-[10px] text-slate-600">Consignee: {consignee}</p>
            )}
          </section>
          <section className="rounded-md border border-slate-200 p-2.5">
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-[#c4161c]">Bill from</p>
            <p className="text-[12px] font-bold leading-tight">{JCT_OFFICIAL.shortName}</p>
            <p className="mt-1 text-[10px] leading-snug text-slate-700">{JCT_OFFICIAL.address}</p>
            <p className="text-[10px] text-slate-700">Fax {JCT_OFFICIAL.fax} · Tel {JCT_OFFICIAL.phone}</p>
            <p className="text-[10px] text-slate-700">{JCT_OFFICIAL.email}</p>
            <p className="text-[10px] text-slate-700">{JCT_OFFICIAL.website}</p>
          </section>
        </div>

        <div className="mt-2.5 grid grid-cols-5 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
          {[
            ['Type', shipmentType || 'RORO'],
            ['Mode', mode],
            ['Term', shipmentTerm || 'FOB'],
            ['POL', portOfLoading || 'Nagoya, Japan'],
            ['POD', portOfDischarge || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-2 py-1.5">
              <p className="text-[7.5px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="text-[10px] font-semibold leading-tight text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <p className="mt-2 mb-1 text-[9px] font-semibold text-slate-500">Vehicles · {units} unit{units === 1 ? '' : 's'}</p>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-2 py-1.5 text-left font-semibold">Chassis</th>
              <th className="px-2 py-1.5 text-left font-semibold">Stock</th>
              <th className="px-2 py-1.5 text-center font-semibold">Deposit</th>
              <th className="px-2 py-1.5 text-right font-semibold">Vehicle cost</th>
            </tr>
          </thead>
          <tbody>
            {(lines.length ? lines : [{ description: '—', quantity: 1, unit_price: 0, line_total: 0 }]).map((line, idx) => {
              const vehicle = vehicles.find((v) => v.id === line.vehicle_id);
              const chassis = vehicle?.chassis_number || extractChassis(line.description) || '—';
              const stock = vehicle
                ? [vehicle.stock_number, vehicle.make, vehicle.model].filter(Boolean).join(' · ')
                : line.description;
              const deposit =
                line.discount && line.unit_price
                  ? `${Math.round((Number(line.discount) / Number(line.unit_price)) * 100)}%`
                  : '—';
              return (
                <tr key={idx} className={idx % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="border-b border-slate-200 px-2 py-1 font-mono text-[9px]">{chassis}</td>
                  <td className="border-b border-slate-200 px-2 py-1">{stock}</td>
                  <td className="border-b border-slate-200 px-2 py-1 text-center">{deposit}</td>
                  <td className="border-b border-slate-200 px-2 py-1 text-right font-medium">
                    {formatMoney(line.unit_price, currency)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#c4161c] text-white">
              <td colSpan={3} className="px-2 py-1.5 text-right text-[10px] font-bold tracking-wide">
                TOTAL
              </td>
              <td className="px-2 py-1.5 text-right text-[12px] font-black">{formatMoney(grandTotal, currency)}</td>
            </tr>
          </tbody>
        </table>

        <section className="mt-2.5 rounded-md border border-slate-200 p-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c4161c]">Banking details</p>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <p className="mb-0.5 text-[8px] font-bold text-slate-900">Beneficiary Bank (Account with Institution)</p>
              <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.name} />
              <BankLine label="Branch Name" value={JCT_OFFICIAL.bank.branch} />
              <BankLine label="Bank Address" value={JCT_OFFICIAL.bank.address} />
              <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.swift} />
            </div>
            <div>
              <p className="mb-0.5 text-[8px] font-bold text-slate-900">Beneficiary Information</p>
              <BankLine label="Account Number" value={JCT_OFFICIAL.bank.account} />
              <BankLine label="Beneficiary Name" value={JCT_OFFICIAL.bank.beneficiary} />
              <BankLine label="Beneficiary Address" value={JCT_OFFICIAL.bank.beneficiaryAddress} />
            </div>
            <div>
              <p className="mb-0.5 text-[8px] font-bold text-slate-900">Intermediary Bank</p>
              <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.intermediaryName} />
              <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.intermediarySwift} />
              <BankLine label="Intermediary Bank address" value={JCT_OFFICIAL.bank.intermediaryAddress} />
            </div>
          </div>
        </section>

        {notes && <p className="mt-1.5 text-[9px] text-slate-600 line-clamp-2">Notes: {notes}</p>}

        <footer className="mt-auto pt-3">
          <div className="grid grid-cols-[72px_1fr_72px] items-center gap-2">
            <div className="flex justify-start">
              <JctHanko className="!h-[64px] !w-[64px]" />
            </div>
            <div className="px-2 text-center">
              <p className="text-[11px] font-bold leading-tight tracking-tight text-slate-900">
                {JCT_OFFICIAL.legalName}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-700">
                <span className="font-semibold">{JCT_OFFICIAL.directorTitle}</span>
                <span className="ml-1.5 text-[12px] font-black tracking-tight text-slate-900">{JCT_OFFICIAL.director}</span>
              </p>
              <p className="mt-0.5 text-[8px] leading-snug text-slate-600">
                2-505-101, DAITOURO, NAKAGAWA-KU, NAGOYA-SHI, AICHI-KEN 454-0943 JAPAN
              </p>
              <p className="text-[8px] text-slate-600">PHONE :+81 52-717-4476</p>
            </div>
            <div className="flex justify-end">
              {showQr && verificationUrl ? (
                <div className="flex flex-col items-center">
                  <InvoiceQRCode value={verificationUrl} size={52} />
                  <p className="mt-0.5 text-[6px] text-slate-400">Verify</p>
                </div>
              ) : (
                <span />
              )}
            </div>
          </div>
          <div className="mt-2 border-t border-slate-300 pt-1.5 text-center">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-700">SIGNATURE OF AUTHORISED PERSON</p>
          </div>
        </footer>
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
