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
          'flex h-8 min-h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm text-foreground ring-offset-background placeholder:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          type === 'file' &&
            'h-9 min-h-9 cursor-pointer py-1.5 file:mr-2.5 file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90',
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
