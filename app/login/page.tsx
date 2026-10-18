'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import {
  JCT_LOGO_HEIGHT,
  JCT_LOGO_SRC,
  JCT_LOGO_WIDTH,
} from '@/components/public/brand-logo';
import { getPostLoginPath } from '@/lib/nav';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
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
    <div className="grid min-h-[100dvh] lg:grid-cols-[55fr_45fr]">
      {/* 4.4 Left brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/hero/export-lot-02.jpg"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--jct-navy)]/95 via-[var(--jct-navy)]/88 to-[var(--jct-navy)]/70" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="inline-flex w-fit items-center rounded-2xl bg-white px-4 py-2.5 shadow-lg">
            <Image
              src={JCT_LOGO_SRC}
              alt=""
              width={JCT_LOGO_WIDTH}
              height={JCT_LOGO_HEIGHT}
              sizes="160px"
              className="h-14 w-[97px] object-contain xl:h-16 xl:w-[110px]"
              priority
            />
          </div>
          <div className="max-w-lg">
            <h1 className="font-display text-4xl font-bold leading-tight text-white xl:text-[2.75rem]">
              One workspace for every export, from auction to{' '}
              <span className="text-[var(--jct-vermilion)]">arrival</span>.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Stock, invoices, remittances and shipping — role-based access for your team.
            </p>
          </div>
          <p className="text-sm text-white/55">
            Role-based access · English / 日本語
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="erp-shell relative flex items-center justify-center px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 80% 20%, hsl(0 72% 48% / 0.12), transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-[430px]">
          <div className="mb-6 flex flex-col items-center gap-2 text-center lg:hidden">
            <div className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-glass ring-1 ring-border/50">
              <Image
                src={JCT_LOGO_SRC}
                alt=""
                width={JCT_LOGO_WIDTH}
                height={JCT_LOGO_HEIGHT}
                sizes="120px"
                className="h-12 w-[83px] object-contain"
                priority
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Staff sign-in</p>
          </div>

          <div className="glass-panel-strong rounded-[1.125rem] border border-border/40 p-6 shadow-glass sm:p-8">
            <h2 className="text-center text-xl font-semibold text-foreground">Sign in</h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Access your ERP workspace
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                    className="h-11 pl-9 text-base md:text-sm"
                    required
                    autoComplete="email"
                    aria-invalid={error ? true : undefined}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative flex items-center">
                  <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-9 pr-10 text-base md:text-sm"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-[hsl(var(--brand))]"
                  />
                  Keep me signed in
                </label>
                <Link href="/login/reset" className="font-medium text-brand hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Need an account? Ask your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="erp-shell flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
