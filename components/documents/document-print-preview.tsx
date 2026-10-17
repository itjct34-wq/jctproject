'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** A4 width at 96dpi — used to fit the sheet to the preview stage. */
const A4_CSS_PX = (210 / 25.4) * 96;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  toolbar?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Full-screen document preview: sticky toolbar + footer, scrollable/pinchable
 * A4 sheet that scales to the viewport width on phone and desktop.
 */
export function DocumentPrintPreview({
  open,
  onOpenChange,
  title,
  toolbar,
  footer,
  children,
  className,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalH, setNaturalH] = useState(0);

  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    const measure = measureRef.current;
    if (!stage || !measure) return;

    const update = () => {
      const pad = window.matchMedia('(max-width: 640px)').matches ? 16 : 32;
      const available = Math.max(160, stage.clientWidth - pad);
      const next = Math.min(1, available / A4_CSS_PX);
      setScale(next > 0.05 ? next : 1);
      setNaturalH(measure.scrollHeight || measure.offsetHeight || 0);
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(stage);
    ro.observe(measure);
    // Re-measure after images / QR paint
    const t1 = window.setTimeout(update, 120);
    const t2 = window.setTimeout(update, 600);
    return () => {
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, children]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        fullscreen
        data-dialog-preview="true"
        className={cn(
          'document-print-preview-dialog print:max-w-none print:border-0 print:shadow-none',
          className
        )}
      >
        <DialogHeader className="print:hidden shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {toolbar ? (
          <div className="document-preview-toolbar print:hidden shrink-0 px-3 pb-2 sm:px-4">
            {toolbar}
          </div>
        ) : null}

        <div ref={stageRef} className="document-preview-stage print:overflow-visible print:bg-white print:p-0">
          <div
            className="document-preview-fit print:w-auto print:h-auto"
            style={{
              width: `${A4_CSS_PX * scale}px`,
              height: naturalH > 0 ? `${naturalH * scale}px` : undefined,
              maxWidth: '100%',
            }}
          >
            <div
              ref={measureRef}
              className="document-preview-canvas print:transform-none"
              style={{
                width: `${A4_CSS_PX}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {children}
            </div>
          </div>
        </div>

        <DialogFooter className="document-preview-footer print:hidden shrink-0 flex-wrap gap-2 px-3 py-3 sm:px-4">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
