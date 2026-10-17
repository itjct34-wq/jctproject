import { CATALOG_MAKES, makeMatches } from '@/lib/public/catalog';
import { loadPublicVehicles, type PublicVehicle } from '@/lib/public/vehicles';
import { createServerClient } from '@/lib/supabase/server';
import { fetchVehicleMakes, fetchVehicleModels } from '@/lib/shipping-catalog';

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

/** Prefer config catalogs (vehicle_makes / vehicle_models); fall back to static + stock. */
async function loadCatalogModelsByMake(): Promise<{
  makeNames: string[];
  modelsByMake: Record<string, string[]>;
}> {
  try {
    const supabase = await createServerClient();
    const [{ data: makeRows }, { data: modelRows }] = await Promise.all([
      fetchVehicleMakes(supabase, true),
      fetchVehicleModels(supabase, undefined, true),
    ]);
    if (!makeRows.length) return { makeNames: [], modelsByMake: {} };

    const byId = new Map(makeRows.map((m) => [m.id, m.name]));
    const modelsByMake: Record<string, string[]> = {};
    for (const make of makeRows) {
      modelsByMake[make.name] = [];
    }
    for (const model of modelRows) {
      const makeName = byId.get(model.make_id);
      if (!makeName) continue;
      if (!modelsByMake[makeName]) modelsByMake[makeName] = [];
      if (!modelsByMake[makeName].includes(model.name)) {
        modelsByMake[makeName].push(model.name);
      }
    }
    for (const list of Object.values(modelsByMake)) {
      list.sort((a, b) => a.localeCompare(b));
    }
    return {
      makeNames: makeRows.map((m) => m.name),
      modelsByMake,
    };
  } catch {
    return { makeNames: [], modelsByMake: {} };
  }
}

function mergeModels(
  primary: Record<string, string[]>,
  extra: Record<string, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...primary };
  for (const [make, models] of Object.entries(extra)) {
    if (!out[make]) out[make] = [];
    for (const model of models) {
      if (!out[make].includes(model)) out[make].push(model);
    }
    out[make].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

export async function loadHomeData(): Promise<HomeData> {
  try {
    const [stock, catalog] = await Promise.all([
      loadPublicVehicles(200, 'car'),
      loadCatalogModelsByMake(),
    ]);

    const counts = new Map<string, number>();
    const stockModelsByMake: Record<string, string[]> = {};

    for (const vehicle of stock) {
      const catalogMake = CATALOG_MAKES.find((make) => makeMatches(vehicle.make, make));
      const key = catalogMake?.name ?? vehicle.make;
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!stockModelsByMake[key]) stockModelsByMake[key] = [];
      if (vehicle.model && !stockModelsByMake[key].includes(vehicle.model)) {
        stockModelsByMake[key].push(vehicle.model);
      }
    }

    for (const list of Object.values(stockModelsByMake)) {
      list.sort((a, b) => a.localeCompare(b));
    }

    const modelsByMake = mergeModels(catalog.modelsByMake, stockModelsByMake);

    const makeNameSet = new Set<string>([
      ...CATALOG_MAKES.filter((m) => m.kind === 'car').map((m) => m.name),
      ...catalog.makeNames,
      ...Object.keys(stockModelsByMake),
    ]);

    const makes: HomeMakeRow[] = Array.from(makeNameSet)
      .map((name) => {
        const staticMake = CATALOG_MAKES.find((m) => m.name === name);
        return {
          name,
          slug: staticMake?.slug ?? name.toLowerCase().replace(/\s+/g, '-'),
          logoPath: staticMake?.logoPath ?? null,
          cars: counts.get(name) || 0,
        };
      })
      .sort((a, b) => {
        const orderA = CATALOG_MAKES.find((m) => m.name === a.name)?.sortOrder ?? 999;
        const orderB = CATALOG_MAKES.find((m) => m.name === b.name)?.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        if (b.cars !== a.cars) return b.cars - a.cars;
        return a.name.localeCompare(b.name);
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
