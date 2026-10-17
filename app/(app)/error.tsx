'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/60 shadow-glass">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {error.message || 'This page could not be loaded. Try again or return to the dashboard.'}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
