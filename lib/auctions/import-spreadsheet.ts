import type { SupabaseClient } from '@supabase/supabase-js';

export type AuctionImportResult = { ok: number; failed: number; errors: string[] };

export async function importAuctionSpreadsheetRows(
  supabase: SupabaseClient,
  profileId: string,
  rows: Record<string, string>[],
  extras?: { sourceNote?: string }
): Promise<AuctionImportResult> {
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  const validResults = ['pending', 'won', 'lost', 'cancelled'];
  const sourceNote = extras?.sourceNote?.trim();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const make = (r.make || '').trim();
    const model = (r.model || '').trim();
    if (!make || !model) {
      failed++;
      errors.push(`Row ${i + 2}: make and model required`);
      continue;
    }
    const result = (r.result || 'pending').trim().toLowerCase();
    const notes = [r.notes?.trim(), sourceNote].filter(Boolean).join(' · ') || null;
    const { error } = await supabase.from('auction_listings').insert({
      chassis_number: r.chassis_number?.trim() || null,
      make,
      model,
      model_year: r.model_year ? Number(r.model_year) : null,
      auction_date: r.auction_date?.trim() || null,
      lot_number: r.lot_number?.trim() || null,
      start_price: r.start_price ? Number(r.start_price) : null,
      currency: (r.currency || 'JPY').toUpperCase(),
      result: validResults.includes(result) ? result : 'pending',
      notes,
      created_by: profileId,
    });
    if (error) {
      failed++;
      errors.push(`Row ${i + 2}: ${error.message}`);
    } else {
      ok++;
    }
  }

  return { ok, failed, errors };
}
