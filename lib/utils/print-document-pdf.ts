'use client';

/**
 * Open the browser print dialog with a stable PDF filename and wait for print assets.
 *
 * Prints from an about:blank iframe so the browser chrome does not show the app URL
 * (e.g. …/invoices). Browsers may still inject headers/footers (date, page x of y)
 * from the print dialog — users should uncheck "Headers and footers" if those appear.
 */

async function waitForImages(root: ParentNode, timeoutMs = 8000) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          img.addEventListener('load', done);
          img.addEventListener('error', done);
          // decode() helps when the browser already has bytes but layout is pending
          void img.decode().then(done).catch(done);
          window.setTimeout(done, timeoutMs);
        })
    )
  );
}

/** Inline http(s)/blob images as data URLs so about:blank clones do not re-fetch. */
async function inlineImagesAsDataUrls(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        if (img.complete && img.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          img.src = canvas.toDataURL('image/png');
          return;
        }
      } catch {
        // Canvas tainted (cross-origin without CORS) — fall through to fetch.
      }
      try {
        const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        if (dataUrl) img.src = dataUrl;
      } catch {
        // Keep original src; waitForImages will still try.
      }
    })
  );
}

async function waitForQrReady(root: HTMLElement, timeoutMs = 5000) {
  const pending = () => root.querySelector('[data-qr-pending="true"]');
  if (!pending()) return;
  const start = Date.now();
  while (pending() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

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
    await waitForQrReady(root);
    await waitForImages(root);
    await inlineImagesAsDataUrls(root);
    await waitForImages(root);
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
      // Cloned <img> nodes re-decode even for data: URLs — wait in the iframe too.
      await waitForImages(layer);
      iwin.addEventListener('afterprint', restore, { once: true });
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
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
    await waitForImages(layer);
  }

  window.addEventListener('afterprint', restore, { once: true });
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
  window.print();
  window.setTimeout(restore, 60000);
}
