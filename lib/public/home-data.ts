import { CATALOG_MAKES, makeMatches } from '@/lib/public/catalog';
import { createPublicSupabase } from '@/lib/supabase/public';

export type HomeVehicle = {
  id: string;
  stock_number: string;
  make: string;
  model: string;
  model_year: number | null;
  mileage_km: number | null;
  listed_price: number | null;
  listed_currency: string;
  primary_image_url: string | null;
  transmission: string | null;
  fuel_type: string | null;
  created_at: string | null;
};

export type HomeMakeRow = {
  name: string;
  slug: string;
  logoPath: string | null;
  cars: number;
};

export type HomeData = {
  arrivals: HomeVehicle[];
  makes: HomeMakeRow[];
  modelsByMake: Record<string, string[]>;
};

const EMPTY: HomeData = { arrivals: [], makes: [], modelsByMake: {} };

export async function loadHomeData(): Promise<HomeData> {
  try {
    return await loadHomeDataUnsafe();
  } catch {
    return EMPTY;
  }
}

async function loadHomeDataUnsafe(): Promise<HomeData> {
  const db = createPublicSupabase();
  if (!db) return EMPTY;

  const { data, error } = await db
    .from('vehicles')
    .select(
      'id, stock_number, make, model, model_year, mileage_km, listed_price, listed_currency, primary_image_url, transmission, fuel_type, created_at, updated_at'
    )
    .eq('status', 'in_stock')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error || !data) return EMPTY;

  const stock = data as HomeVehicle[];
  const counts = new Map<string, number>();
  const modelsByMake: Record<string, string[]> = {};

  for (const vehicle of stock) {
    const catalog = CATALOG_MAKES.find((make) => makeMatches(vehicle.make, make));
    const key = catalog?.name ?? vehicle.make;
    counts.set(key, (counts.get(key) || 0) + 1);
    const bucket = catalog?.name ?? vehicle.make;
    if (!modelsByMake[bucket]) modelsByMake[bucket] = [];
    if (vehicle.model && !modelsByMake[bucket].includes(vehicle.model)) {
      modelsByMake[bucket].push(vehicle.model);
    }
  }

  for (const list of Object.values(modelsByMake)) {
    list.sort((a, b) => a.localeCompare(b));
  }

  const makes: HomeMakeRow[] = CATALOG_MAKES.map((make) => ({
    name: make.name,
    slug: make.slug,
    logoPath: make.logoPath,
    cars: counts.get(make.name) || 0,
  })).sort((a, b) => {
    const orderA = CATALOG_MAKES.find((m) => m.name === a.name)?.sortOrder ?? 999;
    const orderB = CATALOG_MAKES.find((m) => m.name === b.name)?.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return b.cars - a.cars;
  });

  return {
    arrivals: stock.slice(0, 8),
    makes,
    modelsByMake,
  };
}
