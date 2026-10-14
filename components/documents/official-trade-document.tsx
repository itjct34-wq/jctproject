import type { Customer, Vehicle } from '@/lib/types';
import {
  JCT_OFFICIAL,
  decodeInvoiceVehicle,
  extractChassis,
  formatDepositRatio,
  formatDocumentNo,
  formatMoney,
  formatTransmissionLabel,
} from '@/lib/jct-official';
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
  chassis_number?: string | null;
  stock_number?: string | null;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  year?: string | null;
  engine?: string | null;
  transmission?: string | null;
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
  vehicles?: (Pick<Vehicle, 'id' | 'stock_number' | 'make' | 'model' | 'chassis_number' | 'model_year' | 'transmission'> & {
    color?: string | null;
  })[];
  grandTotal: number;
  notes?: string | null;
  verificationUrl?: string;
  showQr?: boolean;
  includeBankNotice?: boolean;
  depositMode?: 'ratio' | 'amount';
};

function customerAddress(customer?: Customer | null) {
  if (!customer) return '';
  return (
    [customer.address_line1, customer.address_line2, [customer.city, customer.country].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', ') || ''
  );
}

function LabeledLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="text-[10px] leading-[1.45]">
      <span className="font-semibold">{label}: </span>
      <span>{cellText(value)}</span>
    </p>
  );
}

function PartyBlock({
  heading,
  name,
  phone,
  email,
  address,
}: {
  heading?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}) {
  return (
    <div>
      {heading && (
        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0b1f3a]">{heading}</p>
      )}
      <LabeledLine label="Name" value={name} />
      <LabeledLine label="contact" value={phone} />
      <LabeledLine label="Email" value={email} />
      <LabeledLine label="Address" value={address} />
    </div>
  );
}

function BankLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[8px] leading-[1.4] text-[#0b1f3a]">
      <span className="font-bold">{label}: </span>
      <span>{value}</span>
    </p>
  );
}

function cellText(value?: string | null) {
  const v = value?.trim();
  return v || '—';
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
  depositMode = 'ratio',
}: Props) {
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0) || (lines.length ? 1 : 0);
  const addr = customerAddress(customer);
  const buyerName = customer?.full_name?.trim() || '';
  const consigneeName = (customer?.company_name || customer?.full_name || '').trim();
  const showBuyer = Boolean(buyerName && consigneeName && consigneeName.toLowerCase() !== buyerName.toLowerCase());
  const partyPhone = customer?.phone || customer?.whatsapp || '';
  const mode = shipmentMode || (shipmentType === 'Container' ? '40ft Container' : 'RORO Vessel');
  const printedNo = formatDocumentNo(documentNo);
  const showDeposit = kind === 'invoice';
  const lineColSpan = showDeposit ? 4 : 3;

  return (
    <div className="invoice-print-root bg-white text-[#0b1f3a] max-w-[210mm] mx-auto">
      <div className="invoice-sheet flex flex-col bg-white p-[8mm] print:p-0">
        <header className="flex items-center justify-between gap-4 border-b-2 border-[#c4161c] pb-3">
          <img
            src={JCT_OFFICIAL.logo}
            alt="Japan Circular Trading"
            className="h-[148px] w-auto max-w-[420px] object-contain object-left shrink-0"
          />
          <div className="text-right shrink-0">
            <h1 className="text-[26px] font-black leading-none tracking-tight text-[#0b1f3a]">{title}</h1>
            <p className="mt-1 font-mono text-[12px] font-bold text-[#0b1f3a]">{printedNo}</p>
          </div>
        </header>

        <table className="inv-table mt-2.5 text-[10px]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">{kind === 'invoice' ? 'Issue date' : 'Date'}</th>
              <th className="px-2 py-1 text-left">{kind === 'invoice' ? 'Due date' : 'Valid until'}</th>
              <th className="px-2 py-1 text-left">Sales agent</th>
              <th className="px-2 py-1 text-left">Currency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1.5 font-semibold">{cellText(issueDate)}</td>
              <td className="px-2 py-1.5 font-semibold">{cellText(dueDate || validDate)}</td>
              <td className="px-2 py-1.5 font-semibold">{cellText(salesAgent)}</td>
              <td className="px-2 py-1.5 font-semibold">{cellText(currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-2.5 text-[10px]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">{showBuyer ? 'Buyer / Consignee' : 'Consignee'}</th>
              <th className="px-2 py-1 text-left">Bill from</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1.5">
                {showBuyer && (
                  <div className="mb-2">
                    <PartyBlock
                      heading="Buyer"
                      name={buyerName}
                      phone={partyPhone}
                      email={customer?.email}
                      address={addr}
                    />
                  </div>
                )}
                <PartyBlock
                  heading={showBuyer ? 'Consignee' : undefined}
                  name={consigneeName || buyerName}
                  phone={partyPhone}
                  email={customer?.email}
                  address={addr}
                />
              </td>
              <td className="px-2 py-1.5">
                <p className="text-[12px] font-bold leading-tight">{JCT_OFFICIAL.shortName}</p>
                <p className="mt-1 text-[10px] leading-snug">{JCT_OFFICIAL.address}</p>
                <p className="text-[10px]">Fax {JCT_OFFICIAL.fax} · Tel {JCT_OFFICIAL.phone}</p>
                <p className="text-[10px]">{JCT_OFFICIAL.email}</p>
                <p className="text-[10px]">{JCT_OFFICIAL.website}</p>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-2.5 text-[10px]">
          <thead>
            <tr>
              {['Type', 'Mode', 'Term', 'POL', 'POD'].map((label) => (
                <th key={label} className="px-2 py-1 text-left">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1.5 font-semibold">{shipmentType || 'RORO'}</td>
              <td className="px-2 py-1.5 font-semibold">{mode}</td>
              <td className="px-2 py-1.5 font-semibold">{shipmentTerm || 'FOB'}</td>
              <td className="px-2 py-1.5 font-semibold">{portOfLoading || 'Nagoya, Japan'}</td>
              <td className="px-2 py-1.5 font-semibold">{portOfDischarge || '—'}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2 mb-1 text-[10px] font-bold text-[#0b1f3a]">
          Vehicle information:
          <span className="ml-1 font-medium normal-case tracking-normal">
            {units} unit{units === 1 ? '' : 's'}
          </span>
        </p>
        <table className="inv-table text-[10px]">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left">Chassis</th>
              <th className="px-2 py-1.5 text-left">Car information</th>
              <th className="px-2 py-1.5 text-left">Additional info</th>
              {showDeposit && <th className="px-2 py-1.5 text-center">Deposit</th>}
              <th className="px-2 py-1.5 text-right">Vehicle cost</th>
            </tr>
          </thead>
          <tbody>
            {(lines.length ? lines : [{ description: '—', quantity: 1, unit_price: 0, line_total: 0 }]).map((line, idx) => {
              const vehicle = vehicles.find((v) => v.id === line.vehicle_id);
              const bits = decodeInvoiceVehicle(line.description);
              const chassis = cellText(
                vehicle?.chassis_number || line.chassis_number || bits.chassis_number || extractChassis(line.description)
              );
              const make = vehicle?.make || line.make || bits.make;
              const model = vehicle?.model || line.model || bits.model;
              const year = line.year || bits.year || (vehicle?.model_year != null ? String(vehicle.model_year) : '');
              const engine = line.engine || bits.engine;
              const colour = line.colour || bits.colour || vehicle?.color;
              const transmission = formatTransmissionLabel(
                line.transmission || bits.transmission || vehicle?.transmission
              );
              const deposit =
                depositMode === 'amount'
                  ? line.discount
                    ? formatMoney(Number(line.discount), currency)
                    : '—'
                  : formatDepositRatio(line.discount, line.unit_price);
              return (
                <tr key={idx}>
                  <td className="px-2 py-1.5 font-mono text-[9px] align-top">{chassis}</td>
                  <td className="px-2 py-1.5 align-top">
                    <LabeledLine label="Make" value={make} />
                    <LabeledLine label="model" value={model} />
                    <LabeledLine label="Year" value={year} />
                    <LabeledLine label="Engine" value={engine} />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <LabeledLine label="color" value={colour} />
                    <p className="text-[10px] leading-[1.45]">{cellText(transmission)}</p>
                  </td>
                  {showDeposit && <td className="px-2 py-1.5 text-center align-middle font-semibold">{deposit}</td>}
                  <td className="px-2 py-1.5 text-right align-middle font-medium">{formatMoney(line.unit_price, currency)}</td>
                </tr>
              );
            })}
            <tr className="inv-total">
              <td colSpan={lineColSpan} className="px-2 py-1.5 text-right text-[10px] font-bold tracking-wide">
                Total
              </td>
              <td className="px-2 py-1.5 text-right text-[12px] font-black">{formatMoney(grandTotal, currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-2.5 text-[8px] leading-[1.35]">
          <thead>
            <tr>
              <th colSpan={3} className="px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-[0.18em]">
                BANKING DETAILS
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="w-1/3 px-2 py-1.5">
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-[#0b1f3a]">
                  Beneficiary Bank (Account with Institution)
                </p>
                <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.name} />
                <BankLine label="Branch Name" value={JCT_OFFICIAL.bank.branch} />
                <BankLine label="Bank Address" value={JCT_OFFICIAL.bank.address} />
                <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.swift} />
              </td>
              <td className="w-1/3 px-2 py-1.5">
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-[#0b1f3a]">Beneficiary Information</p>
                <BankLine label="Account Number" value={JCT_OFFICIAL.bank.account} />
                <BankLine label="Beneficiary Name" value={JCT_OFFICIAL.bank.beneficiary} />
                <BankLine label="Beneficiary Address" value={JCT_OFFICIAL.bank.beneficiaryAddress} />
              </td>
              <td className="w-1/3 px-2 py-1.5">
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-[#0b1f3a]">Intermediary Bank</p>
                <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.intermediaryName} />
                <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.intermediarySwift} />
                <BankLine label="Intermediary Bank address" value={JCT_OFFICIAL.bank.intermediaryAddress} />
              </td>
            </tr>
          </tbody>
        </table>

        {notes && <p className="mt-1.5 text-[9px] text-[#0b1f3a] line-clamp-2">Notes: {notes}</p>}

        <footer className="mt-auto pt-3">
          <div className="grid grid-cols-[1fr_108px] items-center gap-2">
            <div className="px-2 text-center">
              <p className="text-[11px] font-bold leading-tight tracking-tight text-[#0b1f3a]">
                {JCT_OFFICIAL.legalName}
              </p>
              <p className="mt-0.5 text-[9px] text-[#0b1f3a]">
                <span className="font-semibold">{JCT_OFFICIAL.directorTitle}</span>{' '}
                <span className="invoice-hanko-name">
                  <span className="invoice-hanko-director">{JCT_OFFICIAL.director}</span>
                  <JctHanko className="invoice-hanko-stamp" />
                </span>
              </p>
              <p className="mt-0.5 text-[8px] leading-snug">
                2-505-101, DAITOURO, NAKAGAWA-KU, NAGOYA-SHI, AICHI-KEN 454-0943 JAPAN
              </p>
              <p className="text-[8px]">PHONE :+81 52-717-4476</p>
            </div>
            <div className="flex justify-end">
              {showQr && verificationUrl ? (
                <div className="invoice-qr-wrap flex flex-col items-center">
                  <InvoiceQRCode value={verificationUrl} size={100} className="invoice-qr" />
                  <p className="mt-0.5 text-[8px] font-semibold tracking-wide">Scan to verify</p>
                </div>
              ) : (
                <span />
              )}
            </div>
          </div>
          <div className="mt-2 border-t-2 border-[#0b1f3a] pt-1.5 text-center">
            <p className="text-[10px] font-semibold tracking-[0.14em]">SIGNATURE OF AUTHORISED PERSON</p>
          </div>
        </footer>
      </div>

      {includeBankNotice && (
        <PaymentInformationNotice
          customerName={customer?.full_name}
          reference={printedNo}
          issueDate={issueDate}
        />
      )}
    </div>
  );
}
