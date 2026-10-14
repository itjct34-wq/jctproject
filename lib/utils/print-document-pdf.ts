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
    const sheet = layer.querySelector('.invoice-sheet') as HTMLElement | null;
    const extraPage = layer.querySelector('.print-page-break');
    if (sheet && !extraPage) {
      const maxW = 735;
      const maxH = 1040;
      const scale = Math.min(1, maxW / Math.max(sheet.scrollWidth, 1), maxH / Math.max(sheet.scrollHeight, 1));
      if (scale < 0.995) {
        sheet.style.transformOrigin = 'top left';
        sheet.style.transform = `scale(${scale})`;
        const wrap = sheet.parentElement as HTMLElement | null;
        if (wrap) {
          wrap.style.width = `${Math.ceil(sheet.scrollWidth * scale)}px`;
          wrap.style.height = `${Math.ceil(sheet.scrollHeight * scale)}px`;
          wrap.style.overflow = 'hidden';
        }
      }
    }
  }

  const restore = () => {
    document.title = previousTitle;
    document.body.classList.remove('printing-document');
    layer?.remove();
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore, { once: true });
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 180)));
  window.print();
  // Some browsers do not emit afterprint consistently; keep the filename title
  // until the print dialog has closed, then restore it.
  window.setTimeout(restore, 60000);
}
