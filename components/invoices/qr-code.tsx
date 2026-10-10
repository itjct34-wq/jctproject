'use client';

import { useMemo } from 'react';

/**
 * QR code for invoice verification links.
 * Uses a public QR image API (no extra npm dependency).
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
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`;
  }, [value, size]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt="Document verification QR code"
      className={`rounded border border-border bg-white ${className}`}
      loading="eager"
    />
  );
}

/** Build the public verification URL for an invoice token */
export function buildVerifyUrl(token: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/verify/${token}`;
}
