import type { SupabaseClient } from '@supabase/supabase-js';

export type YardRow = {
  id: string;
  name: string;
  port_name: string;
  status: 'active' | 'inactive';
  notes: string | null;
  sort_order: number;
};

/** Normalize auction-house city / POL text to a yard port key (e.g. "Nagoya, Japan" → "Nagoya"). */
export function portKeyFromLabel(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  if (!s) return '';
  return s.split(',')[0].trim();
}

export async function fetchYards(
  supabase: SupabaseClient,
  opts?: { portName?: string | null; activeOnly?: boolean }
) {
  let q = supabase.from('yards').select('*').order('sort_order').order('name');
  if (opts?.activeOnly !== false) q = q.eq('status', 'active');
  const port = portKeyFromLabel(opts?.portName || '');
  if (port) q = q.ilike('port_name', port);
  const { data, error } = await q.limit(500);
  return { data: (data || []) as YardRow[], error };
}
