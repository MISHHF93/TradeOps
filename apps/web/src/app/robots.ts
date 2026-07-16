import type { MetadataRoute } from 'next';

/**
 * Public crawl policy — never invite indexing of authenticated surfaces or APIs.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/product', '/solutions/', '/integrations', '/pricing', '/security', '/docs', '/about', '/contact', '/tools', '/status', '/privacy', '/terms', '/acceptable-use', '/how-it-works', '/login', '/register'],
        disallow: ['/app', '/terminal', '/api', '/_next'],
      },
    ],
    sitemap: `${base.replace(/\/$/, '')}/sitemap.xml`,
  };
}
