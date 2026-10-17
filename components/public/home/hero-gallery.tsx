'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const HERO_IMAGES = [
  {
    src: '/images/hero/export-lot-01.jpg',
    alt: 'Rows of used vehicles ready for export at a storage yard',
    credit: 'Unsplash',
  },
  {
    src: '/images/hero/export-lot-02.jpg',
    alt: 'Used cars lined up outdoors before shipping',
    credit: 'Unsplash',
  },
  {
    src: '/images/hero/export-lot-03.jpg',
    alt: 'Performance car staged for inspection and export',
    credit: 'Unsplash',
  },
  {
    src: '/images/hero/export-lot-04.jpg',
    alt: 'Vehicle inventory in an outdoor lot',
    credit: 'Pexels',
  },
] as const;

export function HeroGallery() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[var(--jct-navy)] shadow-[0_20px_50px_rgba(11,31,51,0.25)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {HERO_IMAGES.map((image, index) => (
        <Image
          key={image.src}
          src={image.src}
          alt={image.alt}
          fill
          priority={index === 0}
          sizes="(max-width: 768px) 100vw, 50vw"
          className={`object-cover transition-opacity duration-700 ${
            index === active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1F33]/55 via-transparent to-transparent" />
      <div className="absolute left-4 top-4 flex gap-1.5 sm:left-6">
        {HERO_IMAGES.map((image, index) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Show photo ${index + 1}`}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => setActive(index)}
            className={`h-12 w-16 overflow-hidden rounded-lg border-2 transition sm:h-14 sm:w-20 ${
              index === active
                ? 'border-[var(--jct-vermilion)] ring-2 ring-white/40'
                : 'border-white/50 opacity-80 hover:opacity-100'
            }`}
          >
            <Image src={image.src} alt="" width={80} height={56} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <p className="absolute right-3 top-3 rounded-md bg-black/35 px-2 py-0.5 text-xs text-white/90">
        Photos: {HERO_IMAGES[active]?.credit}
      </p>
      <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl bg-white p-4 shadow-[0_12px_40px_rgba(11,31,51,0.18)] sm:left-auto sm:right-6 sm:w-64">
        <p className="text-xs uppercase tracking-wider text-[var(--jct-muted-2)]">RORO and container</p>
        <p className="mt-1 font-display text-sm font-semibold text-[var(--jct-navy)]">Price terms you can choose</p>
        <p className="mt-2 text-sm text-[var(--jct-muted)]">FOB / C&amp;F / CIF</p>
      </div>
    </div>
  );
}
