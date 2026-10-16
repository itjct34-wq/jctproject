'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type HealthLast = {
  ok: boolean | null;
  at: string | null;
  source: string | null;
  latency_ms: number | null;
  error: string | null;
  host: string | null;
};

type HealthRow = {
  id: string;
  source: string;
  ok: boolean;
  latency_ms: number | null;
  error_message: string | null;
  supabase_host: string | null;
  created_at: string;
};

type HealthPayload = {
  supabase_host: string;
  last: HealthLast | null;
  history: HealthRow[];
  cron_configured: boolean;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminMonitorPage() {
  const { isAdmin } = usePermissions();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [data, setData] = useState<HealthPayload | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-health', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not load system health');
        setData(null);
        return;
      }
      setData(json as HealthPayload);
    } catch {
      toast.error('Could not load system health');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    void load();
  }, [session?.access_token, load]);

  const runManualPing = async () => {
    if (!session?.access_token) {
      toast.error('Please sign in again.');
      return;
    }
    setPinging(true);
    try {
      const res = await fetch('/api/admin/system-health', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Ping failed');
      } else {
        toast.success(`DB OK (${json.latency_ms} ms)`);
      }
      await load();
    } catch {
      toast.error('Ping request failed');
    } finally {
      setPinging(false);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only admins can view the system monitor.
        </p>
      </div>
    );
  }

  const lastOk = data?.last?.ok;
  const statusLabel =
    lastOk === true ? 'OK' : lastOk === false ? 'Fail' : 'Unknown';
  const statusVariant =
    lastOk === true ? 'default' : lastOk === false ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      <PageHeader
        title="System monitor"
        description="Supabase keep-alive status and recent connectivity checks."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading || pinging}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button onClick={() => void runManualPing()} disabled={loading || pinging}>
              {pinging ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Activity className="mr-2 h-4 w-4" />
              )}
              Check DB now
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={statusVariant}>{statusLabel}</Badge>
                {data?.last?.error ? (
                  <p className="mt-2 text-xs text-destructive">{data.last.error}</p>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Last ping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{formatWhen(data?.last?.at)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Source: {data?.last?.source ?? '—'}
                  {data?.last?.latency_ms != null
                    ? ` · ${data.last.latency_ms} ms`
                    : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Supabase host
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="break-all text-sm font-medium">
                  {data?.supabase_host || data?.last?.host || '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cron secret:{' '}
                  {data?.cron_configured ? 'configured' : 'missing on this deploy'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent pings</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.history?.length ? (
                <p className="text-sm text-muted-foreground">
                  No pings recorded yet. Use “Check DB now” or wait for the Vercel cron.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatWhen(row.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">{row.source}</TableCell>
                        <TableCell>
                          <Badge variant={row.ok ? 'default' : 'destructive'}>
                            {row.ok ? 'OK' : 'Fail'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {row.error_message || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
