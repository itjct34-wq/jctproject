'use client';

/** Open the browser print dialog with a stable PDF filename and wait for print assets. */
export async function printDocumentPdf(fileName: string) {
  const previousTitle = document.title;
  const safeName = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'JCT-Document';

  document.title = safeName;
  const root = document.querySelector<HTMLElement>('.invoice-print-root');
  if (root) {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try {
        await img.decode();
      } catch {
        // Continue printing if an optional logo or QR provider is unavailable.
      }
    }));
  }

  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
  // Some browsers do not emit afterprint consistently; keep the filename title
  // until the print dialog has closed, then restore it.
  window.setTimeout(restore, 60000);
}
