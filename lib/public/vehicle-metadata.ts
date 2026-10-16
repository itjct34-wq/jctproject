import type { Metadata } from 'next';
import { createPublicSupabase } from '@/lib/supabase/public';
import { PUBLIC_VEHICLE_COLUMNS } from '@/lib/public/vehicles';
import { STOCK_CATALOGS, type StockCategory } from '@/lib/stock-category';

export async function vehicleDetailMetadata(id: string, category: StockCategory): Promise<Metadata> {
  const catalog = STOCK_CATALOGS[category];
  const fallback: Metadata = {
    title: `${catalog.itemNoun} | Japan Circular Trading`,
    description: `Export ${catalog.itemNoun.toLowerCase()} from Japan Circular Trading.`,
  };
  const db = createPublicSupabase();
  if (!db || !id) return fallback;

  const { data } = await db
    .from('vehicles')
    .select(PUBLIC_VEHICLE_COLUMNS)
    .eq('id', id)
    .in('status', ['in_stock', 'reserved'])
    .maybeSingle();

  if (!data) return fallback;
  const row = data as {
    make?: string;
    model?: string;
    model_year?: number | null;
    stock_number?: string;
    listed_price?: number | null;
    listed_currency?: string | null;
    stock_category?: string | null;
  };
  const title = [row.model_year, row.make, row.model].filter(Boolean).join(' ') || catalog.itemNoun;
  const price =
    row.listed_price != null
      ? `FOB ${row.listed_currency || 'USD'} ${Math.round(Number(row.listed_price)).toLocaleString()}`
      : 'FOB USD on request';
  return {
    title: `${title} | Japan Circular Trading`,
    description: `${title} (${row.stock_number || 'stock'}) — ${price}. ${catalog.itemNoun} for export.`,
  };
}
