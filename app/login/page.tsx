'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { getPostLoginPath } from '@/lib/nav';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError, roleNames } = await signIn(email, password);

    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    const requested = searchParams.get('redirect');
    const defaultPath = getPostLoginPath(roleNames ?? []);
    const redirect =
      requested && requested !== '/dashboard' && requested !== '/'
        ? requested
        : defaultPath;
    router.push(redirect);
    router.refresh();
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
          <p className="text-xs font-medium text-muted-foreground">Staff sign-in</p>
        </div>

        <Card className="border-border/50 shadow-glass backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg text-foreground">Sign in to ERP</CardTitle>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Vehicle export operations system
            </p>
          </CardHeader>
          <CardContent>
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
                <Label htmlFor="email">Email</Label>
                <div className="relative flex items-center">
                  <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-base md:text-sm"
                    required
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/login/reset"
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative flex items-center">
                  <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-11 text-base md:text-sm"
                    required
                    autoComplete="current-password"
                    aria-invalid={error ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-0 flex h-full w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Internal system for authorized personnel only.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="erp-shell flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
