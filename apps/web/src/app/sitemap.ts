import type { MetadataRoute } from 'next';

const PUBLIC_PATHS = [
  '/',
  '/product',
  '/platform',
  '/platform/plans',
  '/how-it-works',
  '/solutions/dropshipping',
  '/solutions/multichannel-commerce',
  '/solutions/product-intelligence',
  '/solutions/supplier-intelligence',
  '/solutions/commerce-automation',
  '/solutions/predictive-commerce',
  '/solutions/individual-sellers',
  '/solutions/small-business',
  '/solutions/agencies',
  '/solutions/enterprise',
  '/solutions/b2b-commerce',
  '/solutions/agentic-commerce',
  '/integrations',
  '/pricing',
  '/security',
  '/docs',
  '/about',
  '/contact',
  '/tools',
  '/tools/profit',
  '/tools/score',
  '/tools/policy',
  '/status',
  '/privacy',
  '/terms',
  '/acceptable-use',
  '/login',
  '/register',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
