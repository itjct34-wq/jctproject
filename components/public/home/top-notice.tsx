import Link from 'next/link';

export function TopNotice() {
  return (
    <div className="bg-[var(--jct-navy)] text-white">
      <div className="jct-home-wrap flex min-h-11 flex-col items-start justify-between gap-1 py-2.5 text-sm sm:flex-row sm:items-center">
        <p>Pay only to official company accounts listed on your invoice.</p>
        <Link
          href="/verify-agent"
          className="font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Verify an agent
        </Link>
      </div>
    </div>
  );
}
