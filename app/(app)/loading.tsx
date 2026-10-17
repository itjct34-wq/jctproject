import { Skeleton } from '@/components/ui/skeleton';

export default function ErpLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading workspace">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="erp-list-panel overflow-hidden p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 max-w-[16rem]" />
              <Skeleton className="h-3 w-1/2 max-w-[12rem]" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
