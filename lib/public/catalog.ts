export type MakeKind = 'car' | 'truck' | 'machinery';

export type CatalogMake = {
  name: string;
  slug: string;
  kind: MakeKind;
  aliases: string[];
  logoPath: string | null;
  sortOrder: number;
};

export type CatalogCountry = {
  name: string;
  iso2: string;
  guideSlug: string;
  sortOrder: number;
};

export const CATALOG_MAKES: CatalogMake[] = [
  { name: 'Toyota', slug: 'toyota', kind: 'car', aliases: [], logoPath: '/brands/toyota.png', sortOrder: 10 },
  { name: 'Nissan', slug: 'nissan', kind: 'car', aliases: [], logoPath: '/brands/nissan.png', sortOrder: 20 },
  { name: 'Honda', slug: 'honda', kind: 'car', aliases: [], logoPath: '/brands/honda.png', sortOrder: 30 },
  { name: 'Mazda', slug: 'mazda', kind: 'car', aliases: [], logoPath: '/brands/mazda.png', sortOrder: 40 },
  { name: 'Mitsubishi', slug: 'mitsubishi', kind: 'car', aliases: [], logoPath: '/brands/mitsubishi.png', sortOrder: 50 },
  { name: 'Subaru', slug: 'subaru', kind: 'car', aliases: [], logoPath: '/brands/subaru.png', sortOrder: 60 },
  { name: 'Suzuki', slug: 'suzuki', kind: 'car', aliases: [], logoPath: '/brands/suzuki.png', sortOrder: 70 },
  { name: 'Daihatsu', slug: 'daihatsu', kind: 'car', aliases: [], logoPath: '/brands/daihatsu.png', sortOrder: 80 },
  { name: 'Lexus', slug: 'lexus', kind: 'car', aliases: [], logoPath: '/brands/lexus.png', sortOrder: 90 },
  { name: 'Isuzu', slug: 'isuzu', kind: 'truck', aliases: [], logoPath: '/brands/isuzu.png', sortOrder: 100 },
  { name: 'Audi', slug: 'audi', kind: 'car', aliases: [], logoPath: '/brands/audi.png', sortOrder: 110 },
  { name: 'BMW', slug: 'bmw', kind: 'car', aliases: [], logoPath: '/brands/bmw.png', sortOrder: 120 },
  { name: 'Fiat', slug: 'fiat', kind: 'car', aliases: [], logoPath: '/brands/fiat.png', sortOrder: 130 },
  { name: 'Ford', slug: 'ford', kind: 'car', aliases: [], logoPath: '/brands/ford.png', sortOrder: 140 },
  { name: 'Hitachi', slug: 'hitachi', kind: 'machinery', aliases: [], logoPath: '/brands/hitachi.svg', sortOrder: 150 },
  { name: 'Hinomoto', slug: 'hinomoto', kind: 'machinery', aliases: [], logoPath: '/brands/hinomoto.svg', sortOrder: 160 },
  { name: 'Hino', slug: 'hino', kind: 'truck', aliases: [], logoPath: '/brands/hino.png', sortOrder: 170 },
  { name: 'Iseki', slug: 'iseki', kind: 'machinery', aliases: [], logoPath: '/brands/iseki.svg', sortOrder: 180 },
  { name: 'John Deere', slug: 'john-deere', kind: 'machinery', aliases: [], logoPath: '/brands/john-deere.svg', sortOrder: 190 },
  { name: 'Kubota', slug: 'kubota', kind: 'machinery', aliases: [], logoPath: '/brands/kubota.svg', sortOrder: 200 },
  { name: 'Land Rover', slug: 'land-rover', kind: 'car', aliases: [], logoPath: '/brands/land-rover.png', sortOrder: 210 },
  { name: 'Massey Ferguson', slug: 'massey-ferguson', kind: 'machinery', aliases: [], logoPath: '/brands/massey-ferguson.svg', sortOrder: 220 },
  { name: 'Mercedes-Benz', slug: 'mercedes-benz', kind: 'car', aliases: ['Mercedes', 'Mercedes Benz'], logoPath: '/brands/mercedes-benz.png', sortOrder: 230 },
  { name: 'Mametora', slug: 'mametora', kind: 'machinery', aliases: [], logoPath: '/brands/mametora.svg', sortOrder: 240 },
  { name: 'Shibaura', slug: 'shibaura', kind: 'machinery', aliases: [], logoPath: '/brands/shibaura.svg', sortOrder: 250 },
  { name: 'Volkswagen', slug: 'volkswagen', kind: 'car', aliases: ['VW'], logoPath: '/brands/volkswagen.png', sortOrder: 260 },
  { name: 'Yanmar', slug: 'yanmar', kind: 'machinery', aliases: [], logoPath: '/brands/yanmar.svg', sortOrder: 270 },
];

export const CATALOG_COUNTRIES: CatalogCountry[] = [
  { name: 'Ghana', iso2: 'gh', guideSlug: 'ghana', sortOrder: 10 },
  { name: 'Kenya', iso2: 'ke', guideSlug: 'kenya', sortOrder: 20 },
  { name: 'Tanzania', iso2: 'tz', guideSlug: 'tanzania', sortOrder: 30 },
  { name: 'Nigeria', iso2: 'ng', guideSlug: 'nigeria', sortOrder: 40 },
  { name: 'Jamaica', iso2: 'jm', guideSlug: 'jamaica', sortOrder: 50 },
  { name: 'Guyana', iso2: 'gy', guideSlug: 'guyana', sortOrder: 60 },
  { name: 'Trinidad and Tobago', iso2: 'tt', guideSlug: 'trinidad-and-tobago', sortOrder: 70 },
  { name: 'United Kingdom', iso2: 'gb', guideSlug: 'united-kingdom', sortOrder: 80 },
  { name: 'Pakistan', iso2: 'pk', guideSlug: 'pakistan', sortOrder: 90 },
  { name: 'Mongolia', iso2: 'mn', guideSlug: 'mongolia', sortOrder: 100 },
];

export const DESTINATION_PORTS = [
  'Tema',
  'Mombasa',
  'Dar es Salaam',
  'Lagos',
  'Kingston',
  'Georgetown',
  'Port of Spain',
  'Southampton',
  'Karachi',
  'Ulaanbaatar',
];

export function makeMatches(vehicleMake: string, catalog: CatalogMake): boolean {
  const n = vehicleMake.trim().toLowerCase();
  if (!n) return false;
  if (n === catalog.name.toLowerCase()) return true;
  return catalog.aliases.some((alias) => alias.toLowerCase() === n);
}

export function makeMonogram(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9\s-]/g, '').split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
