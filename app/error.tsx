'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">The page could not be loaded. Try again or return home.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#0b1f33] px-5 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-[#0b1f33] px-5 py-2 text-sm font-semibold">
          Home
        </Link>
      </div>
    </div>
  );
}
