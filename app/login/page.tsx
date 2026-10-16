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
import { BrandLogo } from '@/components/public/brand-logo';
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-[linear-gradient(160deg,#0F2744_0%,#16375c_42%,#f4f1e8_42%,#eef2f6_100%)] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="rounded-2xl bg-white px-5 py-3 shadow-md">
              <BrandLogo placement="header" label="ERP" className="justify-center" />
            </div>
            <p className="text-xs font-medium text-white/85">Nagoya, Japan · Staff sign-in</p>
          </div>
        </div>

        <Card className="border-2 border-primary/15 shadow-[0_18px_50px_rgba(15,39,68,0.18)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg text-primary">Sign in to ERP</CardTitle>
            <p className="text-center text-xs text-muted-foreground mt-1">Vehicle export operations system</p>
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
                    className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
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

            <p className="text-xs text-muted-foreground text-center mt-4">
              Internal system for authorized personnel only.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-primary/80 mt-6">
          Used vehicle export operations
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
