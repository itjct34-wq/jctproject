'use client';

import { useMemo } from 'react';

/**
 * QR code for invoice verification links.
 * Renders a high-resolution PNG so print/PDF stays scannable.
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
  const src = useMemo(() => {
    const encoded = encodeURIComponent(value);
    const pixels = Math.max(240, size * 4);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${pixels}x${pixels}&ecc=H&margin=1&color=000000&bgcolor=FFFFFF&data=${encoded}`;
  }, [value, size]);

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
