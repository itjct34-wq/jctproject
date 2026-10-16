/** Shared quotation deep-link helpers (QT chip → quotations workspace). */

/** Deep-link that opens print/preview for a quotation. */
export function quotationOpenHref(quotation: { id: string }) {
  return `/quotations?id=${encodeURIComponent(quotation.id)}`;
}
