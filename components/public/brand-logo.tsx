import { JCT_OFFICIAL } from '@/lib/jct-official';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  markClassName?: string;
  /** header = large lockup; footer = smaller but readable */
  placement?: 'header' | 'footer';
};

export function BrandLogo({ className, markClassName, placement = 'header' }: Props) {
  const isHeader = placement === 'header';
  return (
    <span className={cn('flex items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={JCT_OFFICIAL.logo}
        alt="Japan Circular Trading — cars importing and exporting"
        className={cn(
          'block w-auto max-w-none bg-transparent object-contain object-left',
          isHeader
            ? 'h-12 sm:h-16 md:h-[72px] lg:h-[84px] xl:h-24'
            : 'h-11 sm:h-14 md:h-16',
          markClassName
        )}
      />
    </span>
  );
}
