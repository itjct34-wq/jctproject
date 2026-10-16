import type { Customer, Vehicle } from '@/lib/types';
import {
  JCT_OFFICIAL,
  decodeInvoiceVehicle,
  extractChassis,
  formatDepositRatio,
  formatDocumentNo,
  formatMoney,
  formatTransmissionLabel,
  letterheadHankoUrl,
  letterheadLogoUrl,
  letterheadName,
  type CompanyLetterheadSettings,
} from '@/lib/jct-official';
import { JctHanko } from './jct-hanko';
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
  vehiclesTotal?: number;
  freightAmount?: number;
  freightNotes?: string | null;
  insuranceAmount?: number;
  otherAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  notes?: string | null;
  verificationUrl?: string;
  showQr?: boolean;
  depositMode?: 'ratio' | 'amount';
  /** Letterhead logo scale: quotations smaller; invoices larger; auction invoices largest. */
  logoSize?: 'quotation' | 'invoice' | 'auction';
  /** From company_settings; used for letterhead instead of a hard-coded brand name. */
  company?: CompanyLetterheadSettings | null;
};

const LOGO_SIZE_CLASS: Record<NonNullable<Props['logoSize']>, string> = {
  quotation: 'h-[140px] w-auto max-w-[380px] object-contain object-left shrink-0',
  invoice: 'h-[184px] w-auto max-w-[520px] object-contain object-left shrink-0',
  auction: 'h-[220px] w-auto max-w-[620px] object-contain object-left shrink-0',
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
    <p className="text-[8px] leading-[1.25]">
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
    <p className="text-[8px] leading-[1.35] text-[#0b1f3a]">
      <span className="font-bold">{label}: </span>
      <span>{value}</span>
    </p>
  );
}

function cellText(value?: string | null) {
  const v = value?.trim();
  return v || '—';
}

function resolvedLine(line: TradeLine, vehicles: Props['vehicles']) {
  const vehicle = vehicles?.find((v) => v.id === line.vehicle_id);
  const bits = decodeInvoiceVehicle(line.description);
  return {
    chassis: cellText(
      vehicle?.chassis_number || line.chassis_number || bits.chassis_number || extractChassis(line.description)
    ),
    make: vehicle?.make || line.make || bits.make,
    model: vehicle?.model || line.model || bits.model,
    year: line.year || bits.year || (vehicle?.model_year != null ? String(vehicle.model_year) : ''),
    engine: line.engine || bits.engine,
    colour: line.colour || bits.colour || vehicle?.color,
    transmission: formatTransmissionLabel(line.transmission || bits.transmission || vehicle?.transmission),
    qty: Number(line.quantity || 0) || 1,
    unit: Number(line.unit_price || 0),
    amount: Number(line.line_total || 0) || Number(line.quantity || 1) * Number(line.unit_price || 0),
    discount: line.discount,
  };
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
  vehiclesTotal,
  freightAmount = 0,
  freightNotes,
  insuranceAmount = 0,
  otherAmount = 0,
  discountAmount = 0,
  grandTotal,
  notes,
  verificationUrl,
  showQr = true,
  depositMode = 'ratio',
  logoSize,
  company,
}: Props) {
  const displayLines = lines.length ? lines : [{ description: '—', quantity: 1, unit_price: 0, line_total: 0 }];
  const units = displayLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0) || displayLines.length;
  const addr = customerAddress(customer);
  const buyerName = customer?.full_name?.trim() || '';
  const consigneeName = (customer?.company_name || customer?.full_name || '').trim();
  const showBuyer = Boolean(buyerName && consigneeName && consigneeName.toLowerCase() !== buyerName.toLowerCase());
  const partyPhone = customer?.phone || customer?.whatsapp || '';
  const mode = shipmentMode || (shipmentType === 'Container' ? '40ft Container' : 'RORO Vessel');
  const printedNo = formatDocumentNo(documentNo);
  const orgName = letterheadName(company);
  const logoUrl = letterheadLogoUrl(company);
  const hankoUrl = letterheadHankoUrl(company);
  const beneficiaryName = letterheadName(company) || JCT_OFFICIAL.bank.beneficiary;
  const showDeposit = kind === 'invoice';
  const resolvedLogoSize = logoSize ?? (kind === 'quotation' ? 'quotation' : 'invoice');
  const logoClass = LOGO_SIZE_CLASS[resolvedLogoSize];
  const vehiclesSum =
    vehiclesTotal ??
    displayLines.reduce(
      (sum, line) => sum + (Number(line.line_total || 0) || Number(line.quantity || 1) * Number(line.unit_price || 0)),
      0
    );
  const freight = Number(freightAmount || 0);
  const insurance = Number(insuranceAmount || 0);
  const other = Number(otherAmount || 0);
  const discount = Number(discountAmount || 0);
  const computedGrand = vehiclesSum + freight + insurance + other - discount;
  const total = Number.isFinite(grandTotal) ? grandTotal : computedGrand;
  const freightLabel = freightNotes?.trim() || 'Container freight';
  const vehicleColSpan = showDeposit ? 5 : 4;
  const totalWord = kind === 'quotation' ? 'Quotation total' : 'Invoice total';

  return (
    <div className="invoice-print-root bg-white text-[#0b1f3a] max-w-[210mm] mx-auto">
      <div className="invoice-sheet flex flex-col bg-white p-[8mm]">
        <header className="flex items-center justify-between gap-4 border-b-2 border-[#c4161c] pb-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- print docs need a plain img for PDF capture
            <img
              src={logoUrl}
              alt={orgName}
              className={logoClass}
            />
          ) : (
            <div className="min-w-0">
              <p className="text-[14px] font-bold leading-tight tracking-tight text-[#0b1f3a]">{orgName}</p>
              <p className="mt-0.5 text-[8px] leading-snug text-[#0b1f3a]">{JCT_OFFICIAL.address}</p>
            </div>
          )}
          <div className="text-right shrink-0">
            <h1 className="text-[22px] font-black leading-none tracking-tight text-[#0b1f3a]">{title}</h1>
            <p className="mt-1 font-mono text-[12px] font-bold text-[#0b1f3a]">{printedNo}</p>
          </div>
        </header>

        <table className="inv-table mt-2 text-[9px]">
          <thead>
            <tr>
              <th className="px-1.5 py-0.5 text-left">{kind === 'invoice' ? 'Issue date' : 'Date'}</th>
              <th className="px-1.5 py-0.5 text-left">{kind === 'invoice' ? 'Due date' : 'Valid until'}</th>
              <th className="px-1.5 py-0.5 text-left">Sales agent</th>
              <th className="px-1.5 py-0.5 text-left">Currency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1.5 py-1 font-semibold">{cellText(issueDate)}</td>
              <td className="px-1.5 py-1 font-semibold">{cellText(dueDate || validDate)}</td>
              <td className="px-1.5 py-1 font-semibold">{cellText(salesAgent)}</td>
              <td className="px-1.5 py-1 font-semibold">{cellText(currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-1.5 text-[9px]">
          <thead>
            <tr>
              <th className="px-1.5 py-0.5 text-left">{showBuyer ? 'Buyer / Consignee' : 'Consignee'}</th>
              <th className="px-1.5 py-0.5 text-left">Bill from</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1.5 py-1">
                {showBuyer && (
                  <div className="mb-1.5">
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
              <td className="px-1.5 py-1">
                <p className="text-[11px] font-bold leading-tight">{orgName}</p>
                <p className="mt-0.5 text-[9px] leading-snug">{JCT_OFFICIAL.address}</p>
                <p className="text-[9px]">Fax {JCT_OFFICIAL.fax} · Tel {JCT_OFFICIAL.phone}</p>
                <p className="text-[9px]">{JCT_OFFICIAL.email}</p>
                <p className="text-[9px]">{JCT_OFFICIAL.website}</p>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-1.5 text-[9px]">
          <thead>
            <tr>
              {['Type', 'Mode', 'Term', 'POL', 'POD'].map((label) => (
                <th key={label} className="px-1.5 py-0.5 text-left">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1.5 py-1 font-semibold">{shipmentType || 'RORO'}</td>
              <td className="px-1.5 py-1 font-semibold">{mode}</td>
              <td className="px-1.5 py-1 font-semibold">{shipmentTerm || 'FOB'}</td>
              <td className="px-1.5 py-1 font-semibold">{portOfLoading || 'Nagoya, Japan'}</td>
              <td className="px-1.5 py-1 font-semibold">{portOfDischarge || '—'}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-1.5 mb-0.5 text-[9px] font-bold text-[#0b1f3a]">
          Vehicles
          <span className="ml-1 font-medium normal-case tracking-normal">
            {units} unit{units === 1 ? '' : 's'}
          </span>
        </p>
        <table className="inv-table inv-compact text-[8px]">
          <thead>
            <tr>
              <th className="px-1.5 py-0.5 text-left">Chassis</th>
              <th className="px-1.5 py-0.5 text-left">Vehicle / specification</th>
              <th className="px-1.5 py-0.5 text-center">Qty</th>
              <th className="px-1.5 py-0.5 text-right">Unit price</th>
              {showDeposit && <th className="px-1.5 py-0.5 text-center">Deposit</th>}
              <th className="px-1.5 py-0.5 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {displayLines.map((line, idx) => {
              const row = resolvedLine(line, vehicles);
              const deposit =
                depositMode === 'amount'
                  ? row.discount
                    ? formatMoney(Number(row.discount), currency)
                    : '—'
                  : formatDepositRatio(row.discount, row.unit);
              return (
                <tr key={idx}>
                  <td className="px-1.5 py-0.5 font-mono text-[7.5px] align-top">{row.chassis}</td>
                  <td className="px-1.5 py-0.5 align-top">
                    <p className="font-semibold leading-tight">
                      {[row.make, row.model].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="leading-tight">
                      {[row.year, row.engine, row.colour, row.transmission].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="px-1.5 py-0.5 text-center align-middle font-semibold">{row.qty}</td>
                  <td className="px-1.5 py-0.5 text-right align-middle font-medium">{formatMoney(row.unit, currency)}</td>
                  {showDeposit && <td className="px-1.5 py-0.5 text-center align-middle font-semibold">{deposit}</td>}
                  <td className="px-1.5 py-0.5 text-right align-middle font-medium">
                    {formatMoney(row.amount, currency)}
                  </td>
                </tr>
              );
            })}
            <tr className="inv-subtotal">
              <td colSpan={vehicleColSpan} className="px-1.5 py-0.5 text-right text-[8px] font-bold tracking-wide">
                Vehicles total
              </td>
              <td className="px-1.5 py-0.5 text-right text-[10px] font-black">{formatMoney(vehiclesSum, currency)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-1.5 mb-0.5 text-[9px] font-bold text-[#0b1f3a]">Freight</p>
        <table className="inv-table inv-compact text-[8px]">
          <thead>
            <tr>
              <th className="px-1.5 py-0.5 text-left">Description</th>
              <th className="px-1.5 py-0.5 text-left">Currency</th>
              <th className="px-1.5 py-0.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-1.5 py-0.5">{freightLabel}</td>
              <td className="px-1.5 py-0.5 font-semibold">{currency}</td>
              <td className="px-1.5 py-0.5 text-right font-medium">{formatMoney(freight, currency)}</td>
            </tr>
            <tr className="inv-subtotal">
              <td colSpan={2} className="px-1.5 py-0.5 text-right text-[8px] font-bold tracking-wide">
                Freight total
              </td>
              <td className="px-1.5 py-0.5 text-right text-[10px] font-black">{formatMoney(freight, currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table inv-compact mt-1.5 text-[8px]">
          <tbody>
            <tr>
              <td className="px-1.5 py-0.5 text-right font-semibold">Vehicles total</td>
              <td className="w-[28%] px-1.5 py-0.5 text-right">{formatMoney(vehiclesSum, currency)}</td>
            </tr>
            <tr>
              <td className="px-1.5 py-0.5 text-right font-semibold">Freight</td>
              <td className="px-1.5 py-0.5 text-right">{formatMoney(freight, currency)}</td>
            </tr>
            {insurance > 0 && (
              <tr>
                <td className="px-1.5 py-0.5 text-right font-semibold">Insurance</td>
                <td className="px-1.5 py-0.5 text-right">{formatMoney(insurance, currency)}</td>
              </tr>
            )}
            {other > 0 && (
              <tr>
                <td className="px-1.5 py-0.5 text-right font-semibold">Other charges</td>
                <td className="px-1.5 py-0.5 text-right">{formatMoney(other, currency)}</td>
              </tr>
            )}
            {discount > 0 && (
              <tr>
                <td className="px-1.5 py-0.5 text-right font-semibold">Discount</td>
                <td className="px-1.5 py-0.5 text-right">-{formatMoney(discount, currency)}</td>
              </tr>
            )}
            <tr className="inv-total">
              <td className="px-1.5 py-1 text-right text-[9px] font-bold tracking-wide">{totalWord}</td>
              <td className="px-1.5 py-1 text-right text-[11px] font-black">{formatMoney(total, currency)}</td>
            </tr>
          </tbody>
        </table>

        <table className="inv-table mt-1.5 text-[8px] leading-[1.3]">
          <thead>
            <tr>
              <th colSpan={3} className="px-1.5 py-1 text-center text-[8px] font-bold uppercase tracking-[0.18em]">
                BANKING DETAILS
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="w-1/3 px-1.5 py-1">
                <p className="mb-0.5 text-[7.5px] font-bold uppercase tracking-wide text-[#0b1f3a]">
                  Beneficiary Bank (Account with Institution)
                </p>
                <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.name} />
                <BankLine label="Branch Name" value={JCT_OFFICIAL.bank.branch} />
                <BankLine label="Bank Address" value={JCT_OFFICIAL.bank.address} />
                <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.swift} />
              </td>
              <td className="w-1/3 px-1.5 py-1">
                <p className="mb-0.5 text-[7.5px] font-bold uppercase tracking-wide text-[#0b1f3a]">Beneficiary Information</p>
                <BankLine label="Account Number" value={JCT_OFFICIAL.bank.account} />
                <BankLine label="Beneficiary Name" value={beneficiaryName} />
                <BankLine label="Beneficiary Address" value={JCT_OFFICIAL.bank.beneficiaryAddress} />
              </td>
              <td className="w-1/3 px-1.5 py-1">
                <p className="mb-0.5 text-[7.5px] font-bold uppercase tracking-wide text-[#0b1f3a]">Intermediary Bank</p>
                <BankLine label="Bank Name" value={JCT_OFFICIAL.bank.intermediaryName} />
                <BankLine label="SWIFT Code / BIC" value={JCT_OFFICIAL.bank.intermediarySwift} />
                <BankLine label="Intermediary Bank address" value={JCT_OFFICIAL.bank.intermediaryAddress} />
              </td>
            </tr>
          </tbody>
        </table>

        {notes && <p className="mt-1 text-[8px] text-[#0b1f3a] line-clamp-2">Notes: {notes}</p>}

        <footer className="mt-auto pt-1.5">
          <div className="grid grid-cols-[1fr_96px] items-center gap-2">
            <div className="invoice-sign-block px-1 text-center">
              <p className="text-[10px] font-bold leading-tight tracking-tight text-[#0b1f3a] uppercase">
                {orgName}
              </p>
              <div className="invoice-sign-row mt-0.5 flex items-center justify-center gap-3 text-[#0b1f3a]">
                <span className="text-[8.5px] font-semibold whitespace-nowrap">
                  {JCT_OFFICIAL.directorTitle}
                </span>
                <span className="invoice-hanko-name">
                  <span className="invoice-hanko-director">{JCT_OFFICIAL.director}</span>
                  <JctHanko className="invoice-hanko-stamp" src={hankoUrl} alt={`${orgName} seal`} />
                </span>
              </div>
              <p className="mt-0.5 text-[7.5px] leading-snug uppercase">
                2-505-101, DAITOURO, NAKAGAWA-KU, NAGOYA-SHI, AICHI-KEN 454-0943 JAPAN
              </p>
              <p className="text-[7.5px] leading-snug uppercase">PHONE :+81 52-717-4476</p>
            </div>
            <div className="flex justify-end">
              {showQr && verificationUrl ? (
                <div className="invoice-qr-wrap flex flex-col items-center">
                  <InvoiceQRCode value={verificationUrl} size={88} className="invoice-qr" />
                  <p className="mt-0.5 text-[7px] font-semibold tracking-wide">Scan to verify</p>
                </div>
              ) : (
                <span />
              )}
            </div>
          </div>
          <div className="mt-1.5 border-t-2 border-[#0b1f3a] pt-1 text-center">
            <p className="text-[9px] font-semibold tracking-[0.14em]">SIGNATURE OF AUTHORISED PERSON</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
