/** Company seal / hanko for print letterheads. Renders nothing when src is empty. */
export function JctHanko({
  className = '',
  src,
  alt = 'Company seal',
}: {
  className?: string;
  src?: string | null;
  alt?: string;
}) {
  const url = (src || '').trim();
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- print docs need a plain img for PDF capture
    <img
      src={url}
      alt={alt}
      className={`pointer-events-none select-none object-contain ${className}`}
    />
  );
}
