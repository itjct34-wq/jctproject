import { createPublicSupabase } from '@/lib/supabase/public';
import { countryDisplayName, normalizeIso2 } from '@/lib/public/countries';
import { parseStockCategory, type StockCategory } from '@/lib/stock-category';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Columns granted to anon on public.vehicles. Chassis is not selected on the public site. */
export const PUBLIC_VEHICLE_COLUMNS =
  'id, stock_number, stock_category, part_sku, make, model, model_grade, model_year, registration_year, color, mileage_km, transmission, fuel_type, source_country, source_country_code, listed_price, listed_currency, status, primary_image_url, notes';

export type PublicVehicle = {
  id: string;
  stock_number: string;
  stock_category?: StockCategory | string | null;
  part_sku?: string | null;
  make: string;
  model: string;
  model_grade: string | null;
  model_year: number | null;
  registration_year: number | null;
  color: string | null;
  mileage_km: number | null;
  transmission: string | null;
  fuel_type: string | null;
  source_country: string | null;
  source_country_code: string | null;
  listed_price: number | null;
  listed_currency: string;
  status: string;
  primary_image_url: string | null;
  notes: string | null;
  gallery: string[];
};

export type VehicleImageRow = {
  vehicle_id: string;
  image_url: string;
  sort_order: number | null;
  is_primary: boolean | null;
};

export function publicEngineFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/(?:engine)[:\s]+([A-Za-z0-9.]+(?:\s?cc)?)/i);
  return match?.[1] || null;
}

export function stripEngineFromNotes(notes: string | null | undefined): string {
  return (notes || '')
    .replace(/(?:^|\n)\s*engine[:\s]+[A-Za-z0-9.]+(?:\s?cc)?\s*/gi, '\n')
    .replace(/(?:engine)[:\s]+[A-Za-z0-9.]+(?:\s?cc)?/gi, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function mergeEngineIntoNotes(notes: string | null | undefined, engine: string): string | null {
  const body = stripEngineFromNotes(notes);
  const value = engine.trim();
  const merged = value ? (body ? `${body}\nengine: ${value}` : `engine: ${value}`) : body;
  return merged || null;
}

export function uniqueImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = (raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function sortGalleryRows(images: VehicleImageRow[]): VehicleImageRow[] {
  return [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

/** Card cover is always vehicles.primary_image_url when staff ZIP/sheet set it. */
export function coverPhoto(vehicle: Pick<PublicVehicle, 'gallery' | 'primary_image_url'>): string | null {
  return vehicle.primary_image_url || vehicle.gallery?.[0] || null;
}

export function attachGallery(vehicles: Omit<PublicVehicle, 'gallery'>[], images: VehicleImageRow[]): PublicVehicle[] {
  const byId = new Map<string, string[]>();
  for (const row of sortGalleryRows(images)) {
    const list = byId.get(row.vehicle_id) || [];
    if (row.image_url && !list.includes(row.image_url)) list.push(row.image_url);
    byId.set(row.vehicle_id, list);
  }
  return vehicles.map((vehicle) => ({
    ...vehicle,
    gallery: uniqueImageUrls([vehicle.primary_image_url, ...(byId.get(vehicle.id) || [])]),
  }));
}

export function sourceCountryCode(vehicle: Pick<PublicVehicle, 'source_country' | 'source_country_code'>): string {
  return (vehicle.source_country_code || normalizeIso2(vehicle.source_country) || 'jp').toLowerCase();
}

export function sourceCountryLabel(vehicle: Pick<PublicVehicle, 'source_country' | 'source_country_code'>): string {
  return vehicle.source_country?.trim() || countryDisplayName(sourceCountryCode(vehicle)) || 'Japan';
}

export function groupVehiclesBySource(vehicles: PublicVehicle[]): { key: string; label: string; items: PublicVehicle[] }[] {
  const map = new Map<string, PublicVehicle[]>();
  for (const vehicle of vehicles) {
    const key = sourceCountryCode(vehicle);
    const list = map.get(key) || [];
    list.push(vehicle);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: sourceCountryLabel(items[0]),
      items,
    }));
}

const FALLBACK_COLUMNS = PUBLIC_VEHICLE_COLUMNS.replace(', stock_category', '')
  .replace(', source_country_code', '')
  .replace(', part_sku', '');

const COLUMNS_WITHOUT_CATEGORY = PUBLIC_VEHICLE_COLUMNS.replace(', stock_category', '').replace(', part_sku', '');

export async function selectListedVehicles(
  db: SupabaseClient,
  opts: { id?: string; limit?: number; category?: StockCategory } = {}
) {
  const run = (cols: string, filterCategory: boolean) => {
    let query = db.from('vehicles').select(cols).in('status', ['in_stock', 'reserved']);
    if (filterCategory && opts.category) {
      query =
        opts.category === 'car'
          ? query.or('stock_category.eq.car,stock_category.is.null')
          : query.eq('stock_category', opts.category);
    }
    if (opts.id) return query.eq('id', opts.id).maybeSingle();
    return query.order('stock_number', { ascending: false }).limit(opts.limit ?? 96);
  };
  const first = await run(PUBLIC_VEHICLE_COLUMNS, Boolean(opts.category));
  if (!first.error) return first;
  if (opts.category && opts.category !== 'car') {
    return { data: opts.id ? null : [], error: null };
  }
  const withoutCategory = await run(COLUMNS_WITHOUT_CATEGORY, false);
  if (!withoutCategory.error) return withoutCategory;
  return run(FALLBACK_COLUMNS, false);
}

export function listedVehicleCategory(vehicle: Pick<PublicVehicle, 'stock_category'>): StockCategory {
  return parseStockCategory(vehicle.stock_category);
}

export async function loadVehicleGallery(db: SupabaseClient, vehicleIds: string[]): Promise<VehicleImageRow[]> {
  if (!vehicleIds.length) return [];
  const { data, error } = await db
    .from('vehicle_images')
    .select('vehicle_id, image_url, sort_order, is_primary')
    .in('vehicle_id', vehicleIds)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as VehicleImageRow[];
}

export async function loadPublicVehicles(limit = 96, category?: StockCategory): Promise<PublicVehicle[]> {
  const db = createPublicSupabase();
  if (!db) return [];
  const { data, error } = await selectListedVehicles(db, { limit, category });
  if (error || !data) return [];
  const rows = (Array.isArray(data) ? data : [data]) as unknown as Omit<PublicVehicle, 'gallery'>[];
  const images = await loadVehicleGallery(
    db,
    rows.map((row) => row.id)
  );
  return attachGallery(rows, images);
}

export async function loadPublicVehicle(id: string, category?: StockCategory): Promise<PublicVehicle | null> {
  const db = createPublicSupabase();
  if (!db || !id) return null;
  const { data, error } = await selectListedVehicles(db, { id, category });
  if (error || !data) return null;
  const images = await loadVehicleGallery(db, [id]);
  return attachGallery([data as unknown as Omit<PublicVehicle, 'gallery'>], images)[0] || null;
}
