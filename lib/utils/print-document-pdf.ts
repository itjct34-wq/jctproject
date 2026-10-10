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

  // Print a clone placed directly under <body>: the dialog the document lives in is
  // transformed, scrollable and clipped, which makes browsers print a blank/cut page.
  let layer: HTMLDivElement | null = null;
  if (root) {
    layer = document.createElement('div');
    layer.id = 'print-layer';
    layer.appendChild(root.cloneNode(true));
    document.body.appendChild(layer);
    document.body.classList.add('printing-document');
  }

  const restore = () => {
    document.title = previousTitle;
    document.body.classList.remove('printing-document');
    layer?.remove();
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore, { once: true });
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
  window.print();
  // Some browsers do not emit afterprint consistently; keep the filename title
  // until the print dialog has closed, then restore it.
  window.setTimeout(restore, 60000);
}
