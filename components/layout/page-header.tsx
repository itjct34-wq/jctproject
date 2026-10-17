'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-lg font-semibold tracking-tight text-foreground sm:text-xl md:text-2xl">
          {title}
        </h1>
        <div
          className="mt-1.5 h-0.5 w-8 rounded-full bg-brand sm:mt-2 sm:w-10"
          aria-hidden
        />
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-snug text-muted-foreground line-clamp-2 sm:mt-2.5 sm:line-clamp-none">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 sm:shrink-0 [&_button]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
