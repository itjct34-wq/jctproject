const STEPS = [
  { n: '1', t: 'Source', d: 'Stock or auction bid with clear grade targets.' },
  { n: '2', t: 'Quote', d: 'FOB, C&F or CIF quotation and agent verification.' },
  { n: '3', t: 'Ship', d: 'Export documents, RORO or container, marine cover.' },
  { n: '4', t: 'Collect', d: 'Vessel ETA and delivery to your chosen port.' },
];

export function StepsSection() {
  return (
    <section className="bg-[var(--jct-panel)]">
      <div className="jct-home-wrap py-12 md:py-16">
        <h2 className="font-display text-2xl font-semibold text-[var(--jct-navy)] md:text-3xl">
          Buying from Japan, step by step
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--jct-muted-2)]">
          We handle auction, export papers and shipping. You collect at your port.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-2xl border border-[var(--jct-border)] bg-white p-5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--jct-vermilion)] font-display text-sm font-semibold text-white">
                {step.n}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-[var(--jct-navy)]">{step.t}</h3>
              <p className="mt-2 text-sm text-[var(--jct-muted-2)]">{step.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
