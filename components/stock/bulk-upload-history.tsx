'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/lib/supabase/client';
import { listBulkImportBatches } from '@/lib/stock/bulk-import-batches';
import type { BulkImportBatch } from '@/lib/types';
import { FileSpreadsheet, FolderArchive, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const KIND_LABEL: Record<BulkImportBatch['kind'], string> = {
  car: 'Cars sheet',
  machinery: 'Machinery sheet',
  parts: 'Parts sheet',
  third_party: 'Third-party sheet',
  auctions: 'Auction sheet',
  photos: 'Photos ZIP',
};

function countSummary(batch: BulkImportBatch): string {
  const p = batch.payload || {};
  if (batch.source === 'zip') {
    const photos = p.photos ?? p.image_ids?.length ?? 0;
    const units = p.vehicle_ids?.length ?? 0;
    return `${photos} photo(s) · ${units} unit(s)`;
  }
  if (batch.kind === 'auctions') {
    const created = p.created ?? p.listing_ids?.length ?? 0;
    return `${created} listing(s) created`;
  }
  const created = p.created ?? p.created_vehicle_ids?.length ?? 0;
  const updated = p.updated ?? p.updated_vehicle_ids?.length ?? 0;
  return `${created} created · ${updated} updated`;
}

function placeSummary(batch: BulkImportBatch): string | null {
  const p = batch.payload || {};
  const bits = [p.country, p.port].filter(Boolean);
  return bits.length ? bits.join(' · ') : null;
}

export function BulkUploadHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const canManage = can('vehicles', 'create') || can('auctions', 'create');
  const [rows, setRows] = useState<BulkImportBatch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<BulkImportBatch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!canManage) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listBulkImportBatches(supabase);
      setRows(list);
      const ids = [...new Set(list.map((r) => r.created_by).filter((id): id is string => Boolean(id)))];
      if (ids.length > 0) {
        const { data } = await supabase.from('profiles').select('id, full_name, display_name, email').in('id', ids);
        const map: Record<string, string> = {};
        for (const p of data || []) {
          map[p.id] = p.display_name || p.full_name || p.email || 'Staff';
        }
        setNames(map);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load upload history');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const confirmCopy = useMemo(() => {
    if (!pending) return '';
    if (pending.source === 'zip') {
      return 'This removes gallery photos from this ZIP (files + image rows) and restores the cover if other photos remain. Vehicles themselves are not deleted.';
    }
    if (pending.kind === 'auctions') {
      return 'This deletes auction listings created in this sheet. It does not remove vehicles.';
    }
    return 'This deletes vehicles that were newly created in this sheet. Existing chassis that were only updated will be kept.';
  }, [pending]);

  const deleteBatch = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error('Your session expired. Sign in again.');
        return;
      }
      const res = await fetch(`/api/bulk-import/batches/${pending.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        vehiclesRemoved?: number;
        listingsRemoved?: number;
        photosRemoved?: number;
        notes?: string[];
      };
      if (!res.ok) {
        toast.error(payload.error || 'Could not delete that batch');
        return;
      }
      const bits = [
        payload.vehiclesRemoved ? `${payload.vehiclesRemoved} vehicle(s)` : '',
        payload.listingsRemoved ? `${payload.listingsRemoved} listing(s)` : '',
        payload.photosRemoved ? `${payload.photosRemoved} photo(s)` : '',
      ].filter(Boolean);
      toast.success(bits.length ? `Removed ${bits.join(', ')}` : 'Batch cleared');
      (payload.notes || []).slice(0, 4).forEach((n) => toast.message(n));
      setPending(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) return null;

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-brand/80 to-info/50" />
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="text-sm font-semibold">Recent uploads</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Last 50 spreadsheet and photo ZIP batches. Delete a mistaken batch to undo what it created.
          </p>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent uploads yet.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((batch) => {
              const Icon = batch.source === 'zip' ? FolderArchive : FileSpreadsheet;
              const who = (batch.created_by && names[batch.created_by]) || (batch.created_by === profile?.id ? 'You' : 'Staff');
              const place = placeSummary(batch);
              return (
                <div key={batch.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{batch.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABEL[batch.kind]} · {countSummary(batch)}
                      {place ? ` · ${place}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {who} · {new Date(batch.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setPending(batch)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !deleting) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? (
                <>
                  <span className="block font-medium text-foreground">{pending.filename}</span>
                  <span className="mt-2 block">{confirmCopy}</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void deleteBatch();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete batch'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
