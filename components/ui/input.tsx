import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 min-h-9 w-full rounded-xl border border-input/80 bg-background/80 px-3 py-1.5 text-sm text-foreground shadow-sm ring-offset-background backdrop-blur-sm placeholder:font-medium placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          type === 'file' &&
            'h-9 min-h-9 cursor-pointer py-1.5 file:mr-2.5 file:h-7 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-2.5 file:text-xs file:font-semibold file:text-brand-foreground hover:file:bg-brand/90',
          type === 'date' &&
            'min-w-[9.5rem] overflow-visible pr-2.5 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:mr-0.5 [&::-webkit-calendar-picker-indicator]:opacity-100',
          type !== 'file' && 'file:border-0 file:bg-transparent file:text-xs file:font-semibold file:text-foreground',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
