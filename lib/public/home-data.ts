import { CATALOG_MAKES, makeMatches } from '@/lib/public/catalog';
import { loadPublicVehicles, type PublicVehicle } from '@/lib/public/vehicles';

export type HomeVehicle = PublicVehicle;

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
    const stock = await loadPublicVehicles(200, 'car');
    if (!stock.length) return EMPTY;

    const counts = new Map<string, number>();
    const modelsByMake: Record<string, string[]> = {};

    for (const vehicle of stock) {
      const catalog = CATALOG_MAKES.find((make) => makeMatches(vehicle.make, make));
      const key = catalog?.name ?? vehicle.make;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!modelsByMake[key]) modelsByMake[key] = [];
      if (vehicle.model && !modelsByMake[key].includes(vehicle.model)) {
        modelsByMake[key].push(vehicle.model);
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
      arrivals: stock.filter((v) => v.status === 'in_stock').slice(0, 8),
      makes,
      modelsByMake,
    };
  } catch {
    return EMPTY;
  }
}
