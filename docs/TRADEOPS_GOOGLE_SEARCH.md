# Google Search Preparation

## Implemented

- Page titles + meta descriptions (public pages via `publicPageMeta`)
- Canonical URLs (when `NEXT_PUBLIC_SITE_URL` set)
- Open Graph basics
- `app/robots.ts` — disallow `/app`, `/terminal`, `/api`
- `app/sitemap.ts` — public paths only
- Terminal/app `noindex`

## Operator steps (manual)

1. Deploy production domain HTTPS  
2. Search Console property + domain verification  
3. Submit `https://<domain>/sitemap.xml`  
4. URL inspection for homepage  
5. Monitor coverage  

Indexing is **not guaranteed** and is not instantaneous. Do not index authenticated pages.
