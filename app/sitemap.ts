import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://japancirculartrading.com').replace(
  /\/$/,
  ''
);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const paths = [
    '/',
    '/inventory',
    '/machinery',
    '/parts',
    '/about',
    '/contact',
    '/blog',
    '/verify-agent',
    '/download',
  ];
  return paths.map((path) => ({
    url: `${BASE}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
