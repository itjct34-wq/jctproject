export function JctHanko({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex h-[86px] w-[86px] shrink-0 items-center justify-center ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 border-[3px] border-[#c4161c]" />
      <div className="absolute inset-[4px] border border-[#c4161c]" />
      <p className="relative px-1 text-center text-[10px] font-black leading-[1.15] tracking-tight text-[#c4161c]">
        ジャパン
        <br />
        サーキュラー
        <br />
        トレーディング
        <br />
        代表取締役
      </p>
    </div>
  );
}
