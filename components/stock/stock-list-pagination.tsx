'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_STOCK_PAGE_SIZE,
  STOCK_PAGE_SIZES,
  stockPageItems,
  type StockPageSize,
} from '@/lib/stock-list-paging';
import { cn } from '@/lib/utils';

type StockListPaginationProps = {
  page: number;
  pageSize: StockPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: StockPageSize) => void;
  className?: string;
};

export function StockListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: StockListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const items = stockPageItems(safePage, totalPages);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        Showing{' '}
        <span className="font-semibold text-foreground">{from.toLocaleString()}</span>
        –
        <span className="font-semibold text-foreground">{to.toLocaleString()}</span>
        {' '}of{' '}
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {items.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`e-${idx}`}
                className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === safePage ? 'default' : 'outline'}
                size="icon"
                className={cn(
                  'h-9 w-9 min-w-9 text-sm',
                  item === safePage ? 'bg-foreground text-background hover:bg-foreground/90' : ''
                )}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === safePage ? 'page' : undefined}
              >
                {item}
              </Button>
            )
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            value={String(pageSize || DEFAULT_STOCK_PAGE_SIZE)}
            onValueChange={(v) => onPageSizeChange(Number(v) as StockPageSize)}
          >
            <SelectTrigger className="h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCK_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
