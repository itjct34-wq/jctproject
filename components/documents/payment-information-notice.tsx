import { format } from 'date-fns';
import { JCT_OFFICIAL } from '@/lib/jct-official';
import { JctHanko } from './jct-hanko';

type Props = {
  customerName?: string | null;
  reference?: string | null;
  issueDate?: string | Date | null;
};

export function PaymentInformationNotice({ customerName, reference, issueDate }: Props) {
  const { bank } = JCT_OFFICIAL;
  const dateLabel = issueDate ? format(new Date(issueDate), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy');

  return (
    <div className="print-page-break relative overflow-hidden bg-white text-black">
      <div className="flex items-start justify-between bg-[#8f1d24] text-white px-6 py-4">
        <div className="text-[11px] leading-relaxed">
          <p>{JCT_OFFICIAL.phoneIntl}</p>
          <p>{JCT_OFFICIAL.email}</p>
          <p className="mt-1 max-w-[220px]">{JCT_OFFICIAL.addressLetter}</p>
        </div>
        <div className="text-right">
          <img src={JCT_OFFICIAL.logo} alt="JCT Cars Import" className="ml-auto h-24 w-auto object-contain bg-white rounded p-1" />
        </div>
      </div>

      <div className="px-6 py-5 text-[12px] leading-relaxed">
        <p>{dateLabel}</p>
        <p className="mt-2 font-bold">Subject: PAYMENT INFORMATION NOTICE</p>
        <p className="mt-4">Dear {customerName || 'Valued Customer'},</p>
        <p className="mt-3">
          Thank you very much for your continued business with {JCT_OFFICIAL.shortName}.
          Please find below our official bank details for international remittance.
        </p>
        {reference && (
          <p className="mt-2">
            Payment reference: <span className="font-semibold">{reference}</span>
          </p>
        )}

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th colSpan={2} className="border border-black bg-black py-2 text-center text-sm font-bold tracking-wide text-white">
                BANKING DETAILS
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="w-[34%] border border-black bg-gray-50 px-3 py-3 font-bold align-top">
                Beneficiary Bank
                <br />
                (Account with Institution)
              </td>
              <td className="border border-black px-3 py-3 align-top">
                <p>Bank Name: {bank.name}</p>
                <p>Branch Name: {bank.branch}</p>
                <p>Bank Address: {bank.address}</p>
                <p>SWIFT Code / BIC: {bank.swift}</p>
              </td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 px-3 py-3 font-bold align-top">Beneficiary Information</td>
              <td className="border border-black px-3 py-3 align-top">
                <p>Account Number: {bank.account}</p>
                <p>Beneficiary Name: {bank.beneficiary}</p>
                <p>Beneficiary Address: {bank.beneficiaryAddress}</p>
              </td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-50 px-3 py-3 font-bold align-top">Intermediary Bank</td>
              <td className="border border-black px-3 py-3 align-top">
                <p>Bank Name: {bank.intermediaryName}</p>
                <p>SWIFT Code / BIC: {bank.intermediarySwift}</p>
                <p>Intermediary Bank address: {bank.intermediaryAddress}</p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-[11px]">
          <p className="font-bold">Important Notes</p>
          <p>Please ensure the beneficiary name is written exactly as above.</p>
          <p>All bank charges must be paid by the sender.</p>
          <p>Kindly include your Invoice Number or Vehicle Stock Number as payment reference.</p>
        </div>

        <p className="mt-4">
          We appreciate your prompt payment and look forward to continuing successful business together.
        </p>
        <p>Best regards,</p>

        <div className="mt-6 flex items-end gap-4">
          <div>
            <p className="font-medium">{JCT_OFFICIAL.shortName.replace(', LTD.', '')}</p>
            <p className="text-lg font-black tracking-wide">{JCT_OFFICIAL.director}</p>
            <p className="text-[11px]">{JCT_OFFICIAL.directorTitle}</p>
          </div>
          <JctHanko />
        </div>
      </div>

      <div className="mt-8 bg-[#8f1d24] px-6 py-3 text-center text-[10px] leading-relaxed text-white">
        <p>Corporate Number : {JCT_OFFICIAL.corporateNumber}</p>
        <p>Secondhand Dealer License Number : {JCT_OFFICIAL.license}</p>
      </div>
    </div>
  );
}
