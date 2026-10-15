import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BulkImportBatch,
  BulkImportBatchPayload,
  BulkImportKind,
  BulkImportSource,
} from '@/lib/types';

export const BULK_IMPORT_HISTORY_LIMIT = 50;

export function vehicleImageStoragePath(url: string): string | null {
  try {
    const marker = '/object/public/vehicle-images/';
    const u = new URL(url);
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function recordBulkImportBatch(
  supabase: SupabaseClient,
  row: {
    kind: BulkImportKind;
    source: BulkImportSource;
    filename: string;
    created_by: string;
    payload: BulkImportBatchPayload;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('bulk_import_batches')
    .insert({
      kind: row.kind,
      source: row.source,
      filename: row.filename,
      created_by: row.created_by,
      payload: row.payload,
      status: 'active',
    })
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('bulk_import_batches insert failed', error.message);
    return null;
  }
  return (data as { id: string } | null)?.id || null;
}

export async function listBulkImportBatches(
  supabase: SupabaseClient
): Promise<BulkImportBatch[]> {
  const { data, error } = await supabase
    .from('bulk_import_batches')
    .select('id, kind, source, filename, created_by, created_at, payload, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(BULK_IMPORT_HISTORY_LIMIT);
  if (error) throw error;
  return (data || []) as BulkImportBatch[];
}
