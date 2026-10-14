'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = {
  images: string[];
  alt: string;
};

export function VehicleGallery({ images, alt }: Props) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const count = images.length;
  const current = images[active];

  const go = useCallback(
    (dir: number) => {
      if (!count) return;
      setActive((i) => (i + dir + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  if (!current) {
    return (
      <div className="flex aspect-[16/11] items-center justify-center rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] text-sm text-[var(--jct-muted-2)]">
        Photos coming soon
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block w-full overflow-hidden rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="aspect-[16/11] w-full object-cover" />
        {count > 1 ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
            {active + 1} / {count} · tap to enlarge
          </span>
        ) : (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
            Tap to enlarge
          </span>
        )}
      </button>
      {count > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {images.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative h-16 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border ${
                i === active ? 'border-[var(--jct-vermilion)] ring-1 ring-[var(--jct-vermilion)]' : 'border-[var(--jct-border)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/92"
          role="dialog"
          aria-modal="true"
          aria-label="Vehicle photos"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-sm">
              {active + 1} / {count}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"
              aria-label="Close gallery"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-12">
            {count > 1 ? (
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt={alt} className="max-h-full max-w-full object-contain" />
            {count > 1 ? (
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-4"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
