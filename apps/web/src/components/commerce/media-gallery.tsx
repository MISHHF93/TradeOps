'use client';

import { useCallback, useEffect, useState } from 'react';

export type MediaGalleryItem = {
  id: string;
  src: string;
  alt?: string;
  label?: string;
  badge?: string;
  kind?: 'image' | 'video' | 'document' | 'other';
};

/**
 * Modern media strip + lightbox for product/case workspaces.
 * Lazy-loads images; keyboard Escape closes lightbox.
 */
export function MediaGallery({
  items,
  title = 'Media',
  emptyHint = 'No media loaded yet.',
  dense = false,
}: {
  items: MediaGalleryItem[];
  title?: string;
  emptyHint?: string;
  dense?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (active == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && items.length) {
        setActive((i) => (i == null ? 0 : (i + 1) % items.length));
      }
      if (e.key === 'ArrowLeft' && items.length) {
        setActive((i) => (i == null ? 0 : (i - 1 + items.length) % items.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close, items.length]);

  if (!items.length) {
    return (
      <div className="media-gallery media-gallery--empty">
        <p className="meta">{emptyHint}</p>
      </div>
    );
  }

  const current = active != null ? items[active] : null;

  return (
    <div className={`media-gallery ${dense ? 'media-gallery--dense' : ''}`}>
      {!dense ? (
        <div className="media-gallery__head">
          <h3 className="media-gallery__title">{title}</h3>
          <span className="media-gallery__count">{items.length} asset{items.length === 1 ? '' : 's'}</span>
        </div>
      ) : null}
      <div className="media-gallery__grid" role="list">
        {items.map((item, idx) => {
          const isBroken = broken[item.id];
          const isImage = !item.kind || item.kind === 'image';
          return (
            <button
              key={item.id}
              type="button"
              className="media-gallery__tile"
              role="listitem"
              onClick={() => setActive(idx)}
              aria-label={item.alt || item.label || `Media ${idx + 1}`}
            >
              {isImage && !isBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.src}
                  alt={item.alt || ''}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="media-gallery__img"
                  onError={() => setBroken((b) => ({ ...b, [item.id]: true }))}
                />
              ) : (
                <div className="media-gallery__placeholder">
                  <span>{item.kind ?? 'file'}</span>
                </div>
              )}
              {item.badge ? <span className="media-gallery__badge">{item.badge}</span> : null}
              {item.label ? <span className="media-gallery__caption">{item.label}</span> : null}
            </button>
          );
        })}
      </div>

      {current ? (
        <div
          className="media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || 'Media preview'}
          onClick={close}
        >
          <div className="media-lightbox__frame" onClick={(e) => e.stopPropagation()}>
            <header className="media-lightbox__bar">
              <span className="media-lightbox__label">
                {current.label || current.alt || 'Preview'}
                {active != null ? ` · ${active + 1}/${items.length}` : ''}
              </span>
              <div className="media-lightbox__actions">
                <a className="btn ghost" href={current.src} target="_blank" rel="noreferrer">
                  Open original
                </a>
                <button type="button" className="btn secondary" onClick={close}>
                  Close
                </button>
              </div>
            </header>
            <div className="media-lightbox__body">
              {!current.kind || current.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.src}
                  alt={current.alt || ''}
                  className="media-lightbox__img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <p className="meta">Open original to view this {current.kind}.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
