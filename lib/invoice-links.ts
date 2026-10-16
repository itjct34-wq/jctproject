/** Shared invoice deep-link helpers (stock INV chip → invoices workspace). */

export function isAuctionDepositInvoice(inv: {
  payment_terms?: string | null;
  invoice_code?: string | null;
}) {
  return (
    (inv.payment_terms || '').toUpperCase().startsWith('AUCTION DEPOSIT') ||
    /AD\d/i.test(inv.invoice_code || '')
  );
}

/** Deep-link that opens print/preview for an invoice in the correct workspace. */
export function invoiceOpenHref(invoice: {
  id: string;
  invoice_code?: string | null;
  payment_terms?: string | null;
}) {
  const base = isAuctionDepositInvoice(invoice) ? '/auction-invoices' : '/invoices';
  return `${base}?id=${encodeURIComponent(invoice.id)}`;
}

/** When only id + code are known (e.g. stock card), route by code pattern. */
export function invoiceOpenHrefByCode(invoice: { id: string; invoice_code: string }) {
  return invoiceOpenHref({ id: invoice.id, invoice_code: invoice.invoice_code, payment_terms: null });
}
