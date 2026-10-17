'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code for invoice verification links.
 * Renders an inline data-URL PNG so print/PDF (including about:blank iframe
 * clones) never depends on a third-party image host or a network race.
 */
export function InvoiceQRCode({
  value,
  size = 120,
  className = '',
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const pixels = Math.max(240, size * 4);

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: pixels,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return (
      <span
        className={`invoice-qr inline-block rounded-sm border-2 border-slate-900 bg-white p-1 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
        data-qr-pending="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt="Document verification QR code"
      className={`invoice-qr rounded-sm border-2 border-slate-900 bg-white p-1 ${className}`}
      loading="eager"
      decoding="sync"
      data-qr-ready="true"
    />
  );
}

/** Public site origin encoded into printed QR codes (anonymous /verify page). */
export function publicAppOrigin(origin?: string): string {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    '';
  const raw =
    origin ||
    env ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return raw.replace(/\/$/, '');
}

/** Build the public verification URL for an invoice token */
export function buildVerifyUrl(token: string, origin?: string): string {
  return `${publicAppOrigin(origin)}/verify/${token}`;
}
