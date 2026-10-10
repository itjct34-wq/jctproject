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

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error);
      setLoading(false);
      return;
    }

    const redirect = searchParams.get('redirect') || '/dashboard';
    router.push(redirect);
    router.refresh();
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-red-50/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/images/705607377_122127683871150897_4165866362055650133_n-removebg-preview.png"
              alt="Japan Circular Trading"
              className="w-16 h-16 rounded-xl object-contain bg-white border border-border shadow-sm p-1"
            />
            <div className="text-left">
              <h1 className="text-xl font-bold text-foreground tracking-tight">Japan Circular Trading</h1>
              <p className="text-xs text-muted-foreground">Co., Ltd. — Nagoya, Japan</p>
            </div>
          </div>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg">Sign in to ERP</CardTitle>
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
                    placeholder="you@japancirculartrading.com"
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Japan Circular Trading Co., Ltd. — Used Vehicle Export
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          +81 70-2241-6356 · itjct34@gmail.com
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
