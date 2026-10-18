import {
  CATALOG_MAKES,
  formatMakeDisplayName,
  makeSlug,
  resolveCatalogMake,
} from '@/lib/public/catalog';
import {
  attachGallery,
  coverPhoto,
  loadVehicleGallery,
  selectListedVehicles,
  type PublicVehicle,
} from '@/lib/public/vehicles';
import { createPublicSupabase } from '@/lib/supabase/public';
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
  /** Featured grid units (photo-first). */
  arrivals: HomeVehicle[];
  /** Yard-fresh strip — extra units beyond the featured grid when available. */
  justListed: HomeVehicle[];
  /** Featured parts grid (photo-first in-stock parts). */
  featuredParts: HomeVehicle[];
  stockCount: number;
  makes: HomeMakeRow[];
  modelsByMake: Record<string, string[]>;
};

type ListedRow = Omit<PublicVehicle, 'gallery'>;

const EMPTY: HomeData = {
  arrivals: [],
  justListed: [],
  featuredParts: [],
  stockCount: 0,
  makes: [],
  modelsByMake: {},
};

function asPublic(row: ListedRow): PublicVehicle {
  return { ...row, gallery: [] };
}

function photoFirst(a: ListedRow | PublicVehicle, b: ListedRow | PublicVehicle): number {
  const ap = coverPhoto(asPublic(a as ListedRow)) ? 1 : 0;
  const bp = coverPhoto(asPublic(b as ListedRow)) ? 1 : 0;
  if (bp !== ap) return bp - ap;
  return (b.stock_number || '').localeCompare(a.stock_number || '');
}

/** Canonical UI make label (catalog Title Case, else Title Case from raw). */
function canonicalMakeName(raw: string): string {
  return formatMakeDisplayName(raw);
}

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

    const byId = new Map(makeRows.map((m) => [m.id, canonicalMakeName(m.name)]));
    const modelsByMake: Record<string, string[]> = {};
    for (const make of makeRows) {
      modelsByMake[canonicalMakeName(make.name)] = [];
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
      makeNames: makeRows.map((m) => canonicalMakeName(m.name)),
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
    const key = canonicalMakeName(make);
    if (!out[key]) out[key] = [];
    for (const model of models) {
      if (!out[key].includes(model)) out[key].push(model);
    }
    out[key].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

/** Deduplicate make labels case-insensitively, preferring catalog Title Case. */
function collectMakeNames(names: Iterable<string>): string[] {
  const byKey = new Map<string, string>();
  for (const raw of names) {
    const display = canonicalMakeName(raw);
    if (!display) continue;
    const key = display.toLowerCase();
    const resolved = resolveCatalogMake(display);
    if (!byKey.has(key) || resolved) {
      byKey.set(key, resolved?.name ?? display);
    }
  }
  return Array.from(byKey.values());
}

async function loadListedRows(category: 'car' | 'parts', limit: number): Promise<ListedRow[]> {
  const db = createPublicSupabase();
  if (!db) return [];
  const { data, error } = await selectListedVehicles(db, { limit, category });
  if (error || !data) return [];
  return (Array.isArray(data) ? data : [data]) as unknown as ListedRow[];
}

async function withGalleries(rows: ListedRow[]): Promise<PublicVehicle[]> {
  if (!rows.length) return [];
  const db = createPublicSupabase();
  if (!db) return rows.map(asPublic);
  const images = await loadVehicleGallery(
    db,
    rows.map((row) => row.id)
  );
  return attachGallery(rows, images);
}

export async function loadHomeData(): Promise<HomeData> {
  try {
    const [stockRows, partsRows, catalog] = await Promise.all([
      loadListedRows('car', 500),
      loadListedRows('parts', 80),
      loadCatalogModelsByMake(),
    ]);

    const counts = new Map<string, number>();
    const stockModelsByMake: Record<string, string[]> = {};

    for (const vehicle of stockRows) {
      if (!vehicle.make?.trim()) continue;
      const key = canonicalMakeName(vehicle.make);
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

    const makes: HomeMakeRow[] = collectMakeNames([
      ...CATALOG_MAKES.filter((m) => m.kind === 'car').map((m) => m.name),
      ...catalog.makeNames,
      ...Object.keys(stockModelsByMake),
    ])
      .map((name) => {
        const staticMake = resolveCatalogMake(name);
        return {
          name,
          slug: staticMake?.slug ?? makeSlug(name),
          logoPath: staticMake?.logoPath ?? null,
          cars: counts.get(name) || 0,
        };
      })
      .sort((a, b) => {
        const orderA = resolveCatalogMake(a.name)?.sortOrder ?? 999;
        const orderB = resolveCatalogMake(b.name)?.sortOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        if (b.cars !== a.cars) return b.cars - a.cars;
        return a.name.localeCompare(b.name);
      });

    const inStockLite = stockRows.filter((v) => v.status === 'in_stock').sort(photoFirst);
    const featuredLite = inStockLite.slice(0, 8);
    const featuredIds = new Set(featuredLite.map((v) => v.id));
    const justListedLite = inStockLite.filter((v) => !featuredIds.has(v.id)).slice(0, 10);
    const justListedChosen =
      justListedLite.length >= 4 ? justListedLite : inStockLite.slice(0, 10);

    const partsLite = partsRows
      .filter((v) => v.status === 'in_stock' && Boolean(v.primary_image_url))
      .sort(photoFirst)
      .slice(0, 8);

    // Only fetch galleries for units that actually render on the homepage.
    const [featured, justListed, featuredParts] = await Promise.all([
      withGalleries(featuredLite),
      withGalleries(justListedChosen),
      withGalleries(partsLite),
    ]);

    return {
      arrivals: featured,
      justListed,
      featuredParts,
      stockCount: inStockLite.length,
      makes,
      modelsByMake,
    };
  } catch {
    return EMPTY;
  }
}
