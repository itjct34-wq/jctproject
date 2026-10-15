export const STOCK_CATEGORIES = ['car', 'machinery', 'parts'] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export type StockCatalogMeta = {
  category: StockCategory;
  path: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  emptyTitle: string;
  itemNoun: string;
  inquireLabel: string;
  backLabel: string;
};

export const STOCK_CATALOGS: Record<StockCategory, StockCatalogMeta> = {
  car: {
    category: 'car',
    path: '/inventory',
    navLabel: 'Cars',
    eyebrow: 'Global stock',
    title: 'Vehicles for export',
    intro: 'Browse stock grouped by source country. Photos come from the vehicle gallery. Inquire for FOB / C&F / CIF.',
    emptyTitle: 'No matching vehicles',
    itemNoun: 'vehicle',
    inquireLabel: 'Inquire about this vehicle',
    backLabel: 'Back to cars',
  },
  machinery: {
    category: 'machinery',
    path: '/machinery',
    navLabel: 'Machinery',
    eyebrow: 'Machinery stock',
    title: 'Machinery for export',
    intro: 'Browse machinery grouped by source country. Photos come from the gallery. Inquire for FOB / C&F / CIF.',
    emptyTitle: 'No matching machinery',
    itemNoun: 'unit',
    inquireLabel: 'Inquire about this machine',
    backLabel: 'Back to machinery',
  },
  parts: {
    category: 'parts',
    path: '/parts',
    navLabel: 'Parts',
    eyebrow: 'Parts stock',
    title: 'Parts for export',
    intro: 'Browse parts grouped by source country. Photos come from the gallery. Inquire for FOB / C&F / CIF.',
    emptyTitle: 'No matching parts',
    itemNoun: 'part',
    inquireLabel: 'Inquire about this part',
    backLabel: 'Back to parts',
  },
};

export const PUBLIC_STOCK_NAV = [
  STOCK_CATALOGS.car,
  STOCK_CATALOGS.machinery,
  STOCK_CATALOGS.parts,
].map((c) => ({ href: c.path, label: c.navLabel }));

export function parseStockCategory(raw: string | null | undefined): StockCategory {
  const v = (raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['machinery', 'machine', 'machines', 'equipment', 'plant'].includes(v)) return 'machinery';
  if (['parts', 'part', 'spare', 'spares', 'spare_parts', 'component', 'components'].includes(v)) return 'parts';
  return 'car';
}

export function isStockCategory(raw: string | null | undefined): raw is StockCategory {
  return raw === 'car' || raw === 'machinery' || raw === 'parts';
}

export function stockDetailPath(category: StockCategory | null | undefined, id: string): string {
  const meta = STOCK_CATALOGS[parseStockCategory(category)];
  return `${meta.path}/${id}`;
}

export function stockCategoryLabel(category: StockCategory): string {
  if (category === 'machinery') return 'Machinery';
  if (category === 'parts') return 'Parts';
  return 'Car';
}
