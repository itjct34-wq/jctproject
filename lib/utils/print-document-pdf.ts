'use client';

/**
 * Open the browser print dialog with a stable PDF filename.
 *
 * Prints from an about:blank iframe so the browser chrome does not show the app URL.
 * Clone-only pipeline (never mutates the live preview), short timeouts, and a
 * compact print stylesheet so Print / PDF feels smooth and fast.
 */

const IMAGE_WAIT_MS = 2500;
const QR_WAIT_MS = 2500;
const STYLE_WAIT_MS = 1200;

async function waitForImages(root: ParentNode, timeoutMs = IMAGE_WAIT_MS) {
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return;
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          img.addEventListener('load', done);
          img.addEventListener('error', done);
          void img.decode().then(done).catch(done);
          window.setTimeout(done, timeoutMs);
        })
    )
  );
}

/** Inline remote images as data URLs on a clone so about:blank does not re-fetch. */
async function inlineImagesAsDataUrls(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
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
        if (dataUrl) {
          img.src = dataUrl;
          img.removeAttribute('srcset');
        }
      } catch {
        // Keep original src; waitForImages will still try.
      }
    })
  );
}

async function waitForQrReady(root: HTMLElement, timeoutMs = QR_WAIT_MS) {
  const pending = () => root.querySelector('[data-qr-pending="true"]');
  if (!pending()) return;
  const start = Date.now();
  while (pending() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 40));
  }
}

function absoluteStylesheetHrefs(): string[] {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => (node as HTMLLinkElement).href)
    .filter(Boolean);
}

function collectInlineStyles(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent || '')
    .join('\n');
}

/** Minimal print rules so iframe print works even if app CSS is slow to load. */
const PRINT_BOOTSTRAP_CSS = `
html, body { margin: 0; padding: 0; background: #fff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#print-layer { display: block; }
.invoice-print-root { color: #0b1f3a; max-width: 194mm; width: 194mm; margin: 0 auto; }
.invoice-sheet { box-sizing: border-box; width: 194mm; padding: 8mm; }
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  body > *:not(#print-layer) { display: none !important; }
  #print-layer { display: block !important; }
  .invoice-print-root, .invoice-sheet { box-shadow: none !important; }
  img { break-inside: avoid; max-width: 100%; }
  .invoice-qr-wrap { break-inside: avoid; }
  .invoice-verify-url { word-break: break-all; }
}
`;

function loadStylesInto(doc: Document, hrefs: string[], inlineCss: string, timeoutMs: number) {
  const boot = doc.createElement('style');
  boot.textContent = PRINT_BOOTSTRAP_CSS;
  doc.head.appendChild(boot);

  if (inlineCss.trim()) {
    const style = doc.createElement('style');
    style.textContent = inlineCss;
    doc.head.appendChild(style);
  }

  const loads = hrefs.map(
    (href) =>
      new Promise<void>((resolve) => {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => resolve();
        doc.head.appendChild(link);
        window.setTimeout(resolve, timeoutMs);
      })
  );
  return Promise.all(loads);
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

  const liveRoot = document.querySelector<HTMLElement>('.invoice-print-root');
  if (!liveRoot) {
    document.title = safeName;
    window.print();
    document.title = previousTitle;
    return;
  }

  // Prep the live tree for QR only (images stay untouched so preview stays snappy).
  await waitForQrReady(liveRoot);

  const clone = liveRoot.cloneNode(true) as HTMLElement;
  // Parallel: inline clone images while we spin up the iframe shell.
  const prepImages = (async () => {
    await inlineImagesAsDataUrls(clone);
    await waitForImages(clone);
  })();

  let iframe: HTMLIFrameElement | null = null;
  const restore = () => {
    document.title = previousTitle;
    iframe?.remove();
    iframe = null;
  };

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
  if (!idoc || !iwin) {
    iframe.remove();
    document.title = safeName;
    window.print();
    document.title = previousTitle;
    return;
  }

  idoc.open();
  idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body></body></html>');
  idoc.close();
  idoc.title = safeName;
  document.title = safeName;

  const hrefs = absoluteStylesheetHrefs();
  const inlineCss = collectInlineStyles();
  const stylesReady = loadStylesInto(idoc, hrefs, inlineCss, STYLE_WAIT_MS);

  await prepImages;

  const layer = idoc.createElement('div');
  layer.id = 'print-layer';
  layer.appendChild(clone);
  idoc.body.appendChild(layer);
  idoc.body.classList.add('printing-document');

  await stylesReady;
  await waitForImages(layer, 1500);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  iwin.addEventListener('afterprint', restore, { once: true });
  window.setTimeout(restore, 45000);
  iwin.print();
}
