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
            className="jct-btn-primary px-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Request a car
          </Link>
          <Link
            href="/verify-agent"
            className="inline-flex min-h-11 items-center rounded-full border-2 border-white/55 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/12"
          >
            Verify an agent first
          </Link>
        </div>
      </div>
    </section>
  );
}
