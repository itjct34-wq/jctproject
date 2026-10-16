'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getPostLoginPath } from '@/lib/nav';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, roleNames } = await signIn(email, password);

    if (error) {
      toast.error(error);
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
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-glass">
            <span className="text-sm font-bold tracking-wide">ERP</span>
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
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground"
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
