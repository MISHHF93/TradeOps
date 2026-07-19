'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export type LiveSearchHit = {
  id: string;
  objectType: string;
  title: string;
  summary: string;
  href: string;
  score: number;
  imageUrl?: string | null;
  isFixture?: boolean;
};

/**
 * Live typeahead under the command bar search — shows object hits with media thumbs.
 */
export function CommandSearchResults({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [hits, setHits] = useState<LiveSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }

    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/search?q=${encodeURIComponent(q)}`,
          {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: ac.signal,
          },
        );
        if (!res.ok) {
          setHits([]);
          setOpen(false);
          return;
        }
        const body = (await res.json()) as {
          hits?: Array<{
            id: string;
            objectType: string;
            title: string;
            summary: string;
            href: string;
            score: number;
            evidence?: { imageUrl?: string };
            provenance?: { isFixture?: boolean };
          }>;
        };
        const mapped: LiveSearchHit[] = (body.hits ?? []).slice(0, 8).map((h) => ({
          id: h.id,
          objectType: h.objectType,
          title: h.title,
          summary: h.summary,
          href: h.href,
          score: h.score,
          imageUrl: h.evidence?.imageUrl ?? null,
          isFixture: h.provenance?.isFixture,
        }));
        setHits(mapped);
        setOpen(mapped.length > 0);
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setHits([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [q]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      onNavigate?.();
      router.push(href);
    },
    [onNavigate, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && hits[active]) {
        e.preventDefault();
        go(hits[active]!.href);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hits, active, go]);

  if (!open && !loading) return null;
  if (q.length < 2) return null;

  return (
    <div className="cmd-search-dropdown" role="listbox" aria-label="Search results">
      {loading && hits.length === 0 ? (
        <div className="cmd-search-dropdown__empty meta">Searching…</div>
      ) : null}
      {hits.map((h, i) => (
        <button
          key={`${h.objectType}:${h.id}`}
          type="button"
          role="option"
          aria-selected={i === active}
          className={`cmd-search-hit ${i === active ? 'is-active' : ''}`}
          onMouseEnter={() => setActive(i)}
          onClick={() => go(h.href)}
        >
          <span className="cmd-search-hit__thumb">
            {h.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="cmd-search-hit__letter">
                {(h.title || h.objectType).slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span className="cmd-search-hit__body">
            <span className="cmd-search-hit__title">
              {h.title}
              {h.isFixture ? (
                <span className="badge badge-warning" style={{ marginLeft: 6 }}>
                  fixture
                </span>
              ) : null}
            </span>
            <span className="cmd-search-hit__sub meta">
              {h.objectType.replace(/_/g, ' ')} · {h.summary}
            </span>
          </span>
          <span className="cmd-search-hit__score meta">{Math.round(h.score * 100)}</span>
        </button>
      ))}
      {!loading && hits.length === 0 ? (
        <div className="cmd-search-dropdown__empty meta">No matches — try product, case, or order.</div>
      ) : null}
      {hits.length > 0 ? (
        <div className="cmd-search-dropdown__foot meta">
          ↑↓ navigate · Enter open · Esc dismiss ·{' '}
          <Link href={`/terminal?q=${encodeURIComponent(q)}`} onClick={() => setOpen(false)}>
            full search
          </Link>
        </div>
      ) : null}
    </div>
  );
}
