'use client';

/**
 * Open the browser print dialog with a stable PDF filename and wait for print assets.
 *
 * Prints from an about:blank iframe so the browser chrome does not show the app URL
 * (e.g. …/invoices). Browsers may still inject headers/footers (date, page x of y)
 * from the print dialog — users should uncheck "Headers and footers" if those appear.
 */
export async function printDocumentPdf(fileName: string) {
  const previousTitle = document.title;
  const safeName =
    fileName
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9._ -]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120) || 'Document';

  document.title = safeName;
  const root = document.querySelector<HTMLElement>('.invoice-print-root');
  if (root) {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
      images.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) return;
        try {
          await img.decode();
        } catch {
          // Continue printing if an optional logo or QR provider is unavailable.
        }
      })
    );
  }

  let iframe: HTMLIFrameElement | null = null;
  let layer: HTMLDivElement | null = null;

  const restore = () => {
    document.title = previousTitle;
    document.body.classList.remove('printing-document');
    layer?.remove();
    iframe?.remove();
    window.removeEventListener('afterprint', restore);
  };

  const prepareSheetScale = (host: HTMLElement) => {
    const sheet = host.querySelector('.invoice-sheet') as HTMLElement | null;
    const extraPage = host.querySelector('.print-page-break');
    if (!sheet || extraPage) return;
    const maxW = 735;
    const maxH = 1040;
    const scale = Math.min(
      1,
      maxW / Math.max(sheet.scrollWidth, 1),
      maxH / Math.max(sheet.scrollHeight, 1)
    );
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
  };

  if (root) {
    iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print document');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = 'about:blank';
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    const iwin = iframe.contentWindow;
    if (idoc && iwin) {
      idoc.open();
      idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body></body></html>');
      idoc.close();
      idoc.title = safeName;

      // Absolute stylesheet URLs — about:blank cannot resolve /_next/... relative paths.
      const styleLoads: Promise<void>[] = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
        const src = node as HTMLLinkElement;
        const link = idoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = src.href;
        styleLoads.push(
          new Promise<void>((resolve) => {
            link.onload = () => resolve();
            link.onerror = () => resolve();
          })
        );
        idoc.head.appendChild(link);
      });
      document.querySelectorAll('style').forEach((node) => {
        idoc.head.appendChild(node.cloneNode(true));
      });

      layer = idoc.createElement('div');
      layer.id = 'print-layer';
      layer.appendChild(root.cloneNode(true));
      idoc.body.appendChild(layer);
      idoc.body.classList.add('printing-document');
      prepareSheetScale(layer);

      await Promise.all(styleLoads);
      iwin.addEventListener('afterprint', restore, { once: true });
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 180)));
      iwin.print();
      window.setTimeout(restore, 60000);
      return;
    }

    iframe.remove();
    iframe = null;
  }

  // Fallback: body print-layer (may show the page URL in browser headers/footers).
  if (root) {
    layer = document.createElement('div');
    layer.id = 'print-layer';
    layer.appendChild(root.cloneNode(true));
    document.body.appendChild(layer);
    document.body.classList.add('printing-document');
    prepareSheetScale(layer);
  }

  window.addEventListener('afterprint', restore, { once: true });
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 180)));
  window.print();
  window.setTimeout(restore, 60000);
}
