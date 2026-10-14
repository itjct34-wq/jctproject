export function JctHanko({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex h-[72px] w-[72px] shrink-0 items-center justify-center ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full border-[3px] border-red-600" />
      <div className="absolute inset-[5px] rounded-full border border-red-600" />
      <p className="relative px-1 text-center text-[6.5px] font-black leading-[1.15] tracking-tight text-red-600">
        JAPAN
        <br />
        CIRCULAR
        <br />
        TRADING
        <br />
        代表取締役
        <br />
        SAID NAWAZ
      </p>
    </div>
  );
}
