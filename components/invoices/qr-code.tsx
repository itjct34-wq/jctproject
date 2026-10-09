'use client';

import { useMemo } from 'react';

/**
 * Lightweight QR code renderer using QR server API.
 * Works without extra npm install.
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
    <img
      src={src}
      width={size}
      height={size}
      alt="Invoice verification QR code"
      className={`rounded border border-border bg-white ${className}`}
      loading="lazy"
    />
  );
}

/** Build the public verification URL for an invoice token */
export function buildVerifyUrl(token: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://japancirculartrading.com');
  return `${base}/verify/${token}`;
}
