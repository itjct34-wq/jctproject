import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        That URL is not on the Japan Circular Trading site. Browse stock or return home.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-[#0b1f33] px-5 py-2 text-sm font-semibold text-white">
          Home
        </Link>
        <Link href="/inventory" className="rounded-full border border-[#0b1f33] px-5 py-2 text-sm font-semibold">
          Used cars
        </Link>
      </div>
    </div>
  );
}
