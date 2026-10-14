import Link from 'next/link';

export function CtaBand() {
  return (
    <section className="bg-[var(--jct-navy)]">
      <div className="jct-home-wrap py-12 text-center md:py-16">
        <h2 className="font-display text-2xl font-semibold text-white md:text-3xl">Can&apos;t find the car you want?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-white/80">
          Tell us the model, year and budget. Our team searches Japanese auctions for you.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--jct-vermilion)] px-5 text-sm font-semibold text-white hover:bg-[#c23024]"
          >
            Request a car
          </Link>
          <Link
            href="/verify-agent"
            className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 text-sm font-medium text-white hover:bg-white/10"
          >
            Verify an agent first
          </Link>
        </div>
      </div>
    </section>
  );
}
