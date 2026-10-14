export function JctHanko({ className = '' }: { className?: string }) {
  return (
    <img
      src="/images/jct-hanko.png"
      alt="Japan Circular Trading company seal"
      className={`h-[86px] w-[86px] shrink-0 object-contain ${className}`}
    />
  );
}
