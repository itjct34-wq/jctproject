import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://japancirculartrading.com').replace(
  /\/$/,
  ''
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/login', '/settings', '/users', '/invoices', '/payments', '/remittance-insights'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
