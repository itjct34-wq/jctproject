'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function LoginResetPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/login`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="erp-shell relative flex min-h-[100dvh] items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-card shadow-glass ring-1 ring-border/60">
            <Image
              src="/images/jct-official-logo.png"
              alt="JCT"
              width={56}
              height={56}
              className="h-full w-full object-contain p-1"
              priority
            />
          </div>
        </div>

        <Card className="border-border/50 shadow-glass backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg">Reset password</CardTitle>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              We will email you a reset link if the account exists.
            </p>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <p role="status" className="text-sm text-foreground">
                  Check your inbox for a password reset link.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative flex items-center">
                    <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-base md:text-sm"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
                <p className="text-center text-xs">
                  <Link href="/login" className="text-brand hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
