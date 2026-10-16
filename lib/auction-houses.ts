import type { SupabaseClient } from '@supabase/supabase-js';
import type { Supplier } from '@/lib/types';

export type AuctionHousePick = Pick<
  Supplier,
  'id' | 'name' | 'supplier_code' | 'city' | 'country' | 'status' | 'notes' | 'category'
>;

export async function fetchAuctionHouses(
  client: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<{ data: AuctionHousePick[]; error: Error | null }> {
  let query = client
    .from('suppliers')
    .select('id, name, supplier_code, city, country, status, notes, category')
    .eq('supplier_type', 'auction_house')
    .order('name');

  if (options?.activeOnly) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;
  return { data: (data || []) as AuctionHousePick[], error: error as Error | null };
}

export type CreateAuctionHouseInput = {
  name: string;
  city?: string | null;
  country?: string | null;
  createdBy: string;
};

/** Creates or reuses an active auction house row in `suppliers` (supplier_type = auction_house). */
export async function createOrGetAuctionHouse(
  client: SupabaseClient,
  input: CreateAuctionHouseInput
): Promise<{ data: AuctionHousePick | null; error: Error | null; created: boolean }> {
  const name = input.name.trim();
  if (!name) {
    return { data: null, error: new Error('Auction house name is required'), created: false };
  }

  const { data: existing, error: findError } = await client
    .from('suppliers')
    .select('id, name, supplier_code, city, country, status, notes, category')
    .eq('supplier_type', 'auction_house')
    .ilike('name', name)
    .maybeSingle();

  if (findError) {
    return { data: null, error: findError as Error, created: false };
  }

  if (existing) {
    const row = existing as AuctionHousePick;
    if (row.status !== 'active') {
      const { data: reactivated, error: updateError } = await client
        .from('suppliers')
        .update({
          status: 'active',
          city: input.city?.trim() || undefined,
          country: input.country?.trim() || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .select('id, name, supplier_code, city, country, status, notes, category')
        .maybeSingle();
      if (updateError) {
        return { data: null, error: updateError as Error, created: false };
      }
      return { data: reactivated as AuctionHousePick, error: null, created: false };
    }
    return { data: row, error: null, created: false };
  }

  const { data: inserted, error: insertError } = await client
    .from('suppliers')
    .insert({
      name,
      supplier_type: 'auction_house',
      city: input.city?.trim() || null,
      country: input.country?.trim() || 'Japan',
      status: 'active',
      created_by: input.createdBy,
    })
    .select('id, name, supplier_code, city, country, status, notes, category')
    .maybeSingle();

  if (insertError) {
    return { data: null, error: insertError as Error, created: false };
  }

  return { data: inserted as AuctionHousePick, error: null, created: true };
}

export function formatAuctionHouseLabel(house: Pick<AuctionHousePick, 'name' | 'city' | 'country'>): string {
  const place = [house.city, house.country].filter(Boolean).join(', ');
  return place ? `${house.name} (${place})` : house.name;
}
