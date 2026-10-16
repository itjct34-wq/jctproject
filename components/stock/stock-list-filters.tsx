'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type StockFilterOption = { value: string; label: string };

export type StockListFiltersValue = {
  search: string;
  status: string;
  make: string;
  model: string;
  customer: string;
  agent: string;
};

type StockListFiltersProps = {
  total: number;
  totalLabel?: string;
  value: StockListFiltersValue;
  onChange: (next: StockListFiltersValue) => void;
  statusOptions: StockFilterOption[];
  makeOptions: StockFilterOption[];
  modelOptions: StockFilterOption[];
  customerOptions?: StockFilterOption[];
  agentOptions?: StockFilterOption[];
  searchPlaceholder?: string;
  showCustomer?: boolean;
  showAgent?: boolean;
  className?: string;
};

const ALL = 'all';

function FilterSelect({
  value,
  placeholder,
  options,
  onValueChange,
  className,
}: {
  value: string;
  placeholder: string;
  options: StockFilterOption[];
  onValueChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onValueChange(v === ALL ? '' : v)}>
      <SelectTrigger
        className={cn(
          'h-9 min-w-0 flex-1 rounded-md border-border bg-background text-sm font-medium text-muted-foreground data-[placeholder]:font-semibold data-[placeholder]:text-muted-foreground',
          value && value !== ALL ? 'font-medium text-foreground' : '',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StockListFilters({
  total,
  totalLabel = 'Total stocks',
  value,
  onChange,
  statusOptions,
  makeOptions,
  modelOptions,
  customerOptions = [],
  agentOptions = [],
  searchPlaceholder = 'Search stock ID, chassis, make…',
  showCustomer = true,
  showAgent = true,
  className,
}: StockListFiltersProps) {
  const patch = (partial: Partial<StockListFiltersValue>) => onChange({ ...value, ...partial });
  const fieldCount = 4 + (showCustomer ? 1 : 0) + (showAgent ? 1 : 0);

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-semibold text-primary">
        {totalLabel}{' '}
        <span className="font-bold text-foreground">{total.toLocaleString()}</span>
      </p>
      <div className="erp-filter-panel">
        <div
          className={cn(
            'grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3',
            fieldCount >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'
          )}
        >
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-md border-border pl-9 placeholder:font-medium placeholder:text-muted-foreground"
              value={value.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder={searchPlaceholder}
            />
          </div>
          <FilterSelect
            value={value.status}
            placeholder="Status"
            options={statusOptions}
            onValueChange={(status) => patch({ status })}
          />
          <FilterSelect
            value={value.make}
            placeholder="Make"
            options={makeOptions}
            onValueChange={(make) => patch({ make, model: '' })}
          />
          <FilterSelect
            value={value.model}
            placeholder="Model"
            options={modelOptions}
            onValueChange={(model) => patch({ model })}
          />
          {showCustomer ? (
            <FilterSelect
              value={value.customer}
              placeholder="Customer"
              options={customerOptions}
              onValueChange={(customer) => patch({ customer })}
              className="xl:min-w-[10rem]"
            />
          ) : null}
          {showAgent ? (
            <FilterSelect
              value={value.agent}
              placeholder="Sales Agent"
              options={agentOptions}
              onValueChange={(agent) => patch({ agent })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
