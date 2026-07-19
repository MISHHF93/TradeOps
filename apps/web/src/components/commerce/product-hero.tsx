'use client';

import { useMemo } from 'react';
import { MediaGallery, type MediaGalleryItem } from './media-gallery';

/**
 * Product twin hero — primary image + gallery strip from product payload.
 */
export function ProductHero({
  title,
  primaryImageUrl,
  galleryImageUrls,
  mediaJson,
}: {
  title: string;
  primaryImageUrl?: string | null;
  galleryImageUrls?: string[] | null;
  mediaJson?: Array<{ url?: string; purpose?: string; kind?: string }> | null;
}) {
  const items = useMemo(() => {
    const out: MediaGalleryItem[] = [];
    const seen = new Set<string>();
    const push = (url: string, label?: string, badge?: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({
        id: url,
        src: url,
        alt: title,
        label,
        badge,
        kind: 'image',
      });
    };
    if (primaryImageUrl) push(primaryImageUrl, 'Primary', 'primary');
    for (const u of galleryImageUrls ?? []) push(u, 'Gallery');
    for (const m of mediaJson ?? []) {
      if (m.url) push(m.url, m.purpose ?? m.kind, m.purpose);
    }
    return out;
  }, [title, primaryImageUrl, galleryImageUrls, mediaJson]);

  if (!items.length) {
    return (
      <div className="product-hero product-hero--empty">
        <div className="product-hero__placeholder">No media yet</div>
      </div>
    );
  }

  return (
    <div className="product-hero">
      <div className="product-hero__primary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={items[0]!.src}
          alt={title}
          className="product-hero__primary-img"
          referrerPolicy="no-referrer"
        />
      </div>
      {items.length > 1 ? (
        <MediaGallery items={items} dense title="Product media" />
      ) : null}
    </div>
  );
}
