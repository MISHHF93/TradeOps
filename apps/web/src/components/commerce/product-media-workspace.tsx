'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { MediaGallery, type MediaGalleryItem } from './media-gallery';

type Artifact = {
  id: string;
  artifactType: string;
  purpose: string;
  title?: string | null;
  altText?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  rightsStatus: string;
  publicationStatus: string;
  visibility: string;
  qualityScore?: number | null;
  contentUrl?: string | null;
  provenanceLabel?: string;
  sourcePlatform?: string | null;
  fileSizeBytes?: number | null;
};

type ArtifactsResponse = {
  artifacts: Artifact[];
  completeness: { score: number; checks: Record<string, boolean> };
  channelReadiness: {
    google: {
      primaryImagePresent: boolean;
      additionalImages: number;
      resolutionOk: boolean;
      listingEligible: boolean;
      issues: string[];
      recommendedCorrections?: string[];
    };
    shopify: { images: number; videos: number; models3d: number; note: string };
    ebay: { images: number; videos: number; documents: number; note: string };
    amazon?: { localReadyImages?: number; issues?: string[]; publishStatus?: string };
  };
  duplicates?: {
    exact: Array<{ kind: string; checksum: string; artifactIds: string[] }>;
    near: Array<{ kind: string; perceptualHash: string; artifactIds: string[] }>;
  };
  operationStatus?: Record<string, string>;
  honesty?: { note?: string };
};

function resolveContentUrl(contentUrl: string): string {
  if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) return contentUrl;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return contentUrl.startsWith('/') ? `${base}${contentUrl}` : `${base}/${contentUrl}`;
}

/**
 * Product Media Workspace — first-class Digital Twin artifacts with modern gallery.
 */
export function ProductMediaWorkspace({ productId }: { productId: string }) {
  const [data, setData] = useState<ArtifactsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'document' | 'other'>('all');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/products/${productId}/artifacts`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      setData(body as ArtifactsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function bootstrap() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts/bootstrap`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      setData(body as ArtifactsResponse);
      setMsg('Artifacts bootstrapped from product sources (idempotent).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  }

  async function ingestUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts/ingest-url`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: url.trim(), purpose: 'gallery' }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      setMsg(
        (body as { deduped?: boolean }).deduped
          ? 'Exact duplicate detected — linked existing artifact.'
          : 'Remote artifact ingested (rights remain unknown until verified).',
      );
      setUrl('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ingest failed');
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(artifactId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts/${artifactId}/set-primary`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      setMsg('Primary image updated.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Set primary failed');
    } finally {
      setBusy(false);
    }
  }

  async function analyze(artifactId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts/${artifactId}/analyze`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      const proposal = (
        body as { proposal?: { analysis?: Record<string, unknown>; confidence?: number } }
      ).proposal;
      setMsg(
        `AI proposal (review required): ${JSON.stringify(proposal?.analysis ?? {}).slice(0, 180)}… conf ${
          proposal?.confidence ?? '—'
        }`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyze failed');
    } finally {
      setBusy(false);
    }
  }

  const artifacts = data?.artifacts ?? [];
  const filtered = useMemo(() => {
    if (filter === 'all') return artifacts;
    if (filter === 'image') return artifacts.filter((a) => a.artifactType === 'image');
    if (filter === 'document')
      return artifacts.filter(
        (a) => a.artifactType === 'document' || a.artifactType === 'model_3d',
      );
    return artifacts.filter(
      (a) => a.artifactType !== 'image' && a.artifactType !== 'document' && a.artifactType !== 'model_3d',
    );
  }, [artifacts, filter]);

  const galleryItems: MediaGalleryItem[] = useMemo(
    () =>
      filtered
        .filter((a) => a.contentUrl)
        .map((a) => ({
          id: a.id,
          src: resolveContentUrl(a.contentUrl!),
          alt: a.altText ?? a.title ?? 'Product artifact',
          label: `${a.purpose}${a.purpose === 'primary' ? ' ★' : ''}`,
          badge: a.purpose,
          kind:
            a.artifactType === 'image'
              ? 'image'
              : a.artifactType === 'video'
                ? 'video'
                : a.artifactType === 'document' || a.artifactType === 'model_3d'
                  ? 'document'
                  : 'other',
        })),
    [filtered],
  );

  const g = data?.channelReadiness?.google;
  const score = data?.completeness?.score;

  return (
    <article className="panel wide media-workspace">
      <header className="media-workspace__header">
        <div>
          <h2 className="media-workspace__title">Product media &amp; artifacts</h2>
          <p className="meta media-workspace__lede">
            Digital twin media with provenance, rights, and channel readiness — loads all
            discovered assets for this product.
          </p>
        </div>
        <div className="terminal-toolbar media-workspace__toolbar">
          <button type="button" className="btn ai" disabled={busy} onClick={() => void bootstrap()}>
            {busy ? 'Working…' : 'Discover / bootstrap'}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="media-workspace__skeleton" aria-busy="true">
          <div className="skeleton-block skeleton-block--lg" />
          <div className="skeleton-row">
            <div className="skeleton-block" />
            <div className="skeleton-block" />
            <div className="skeleton-block" />
            <div className="skeleton-block" />
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {msg ? <p className="meta text-accent">{msg}</p> : null}
      {data?.honesty?.note ? <p className="meta">{data.honesty.note}</p> : null}

      {data ? (
        <div className="media-workspace__stats detail-grid">
          <div className="panel media-stat-card">
            <h3>Completeness</h3>
            <p className="media-stat-card__score">
              <strong className="text-accent">{score ?? 0}</strong>
              <span className="meta">/100</span>
            </p>
            <ul className="kv">
              {Object.entries(data.completeness.checks).map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <strong className={v ? 'text-positive' : 'text-warning'}>
                    {v ? 'yes' : 'missing'}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel media-stat-card">
            <h3>Channel readiness</h3>
            {g ? (
              <ul className="kv">
                <li>
                  <span>Primary image</span>
                  <strong>{g.primaryImagePresent ? 'yes' : 'no'}</strong>
                </li>
                <li>
                  <span>Additional</span>
                  <strong>{g.additionalImages}</strong>
                </li>
                <li>
                  <span>≥500×500</span>
                  <strong className={g.resolutionOk ? 'text-positive' : 'text-warning'}>
                    {g.resolutionOk ? 'ok' : 'fail'}
                  </strong>
                </li>
                <li>
                  <span>Listing eligible</span>
                  <strong>{g.listingEligible ? 'yes' : 'no'}</strong>
                </li>
              </ul>
            ) : null}
            {g?.issues?.length ? (
              <ul className="meta media-stat-card__issues">
                {g.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
            <p className="meta">{data.channelReadiness.shopify.note}</p>
            <p className="meta">{data.channelReadiness.ebay.note}</p>
          </div>
          {data.duplicates?.exact?.length || data.duplicates?.near?.length ? (
            <div className="panel media-stat-card">
              <h3>Duplicates</h3>
              <p className="meta">Relationships only — not auto-deleted.</p>
              <ul className="meta">
                {(data.duplicates.exact ?? []).map((d) => (
                  <li key={d.checksum}>
                    Exact ({d.artifactIds.length}): {d.checksum.slice(0, 12)}…
                  </li>
                ))}
                {(data.duplicates.near ?? []).map((d) => (
                  <li key={d.perceptualHash}>
                    Near ({d.artifactIds.length}): {d.perceptualHash}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="media-workspace__ingest scanner-filters">
        <input
          type="url"
          placeholder="Ingest authorized https image/PDF URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="btn secondary"
          disabled={busy || !url.trim()}
          onClick={() => void ingestUrl()}
        >
          Ingest URL
        </button>
      </div>

      <div className="media-workspace__filters" role="tablist" aria-label="Media type filter">
        {(
          [
            ['all', 'All'],
            ['image', 'Images'],
            ['document', 'Docs / 3D'],
            ['other', 'Other'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? 'object-workspace-tab is-active' : 'object-workspace-tab'}
            onClick={() => setFilter(id)}
          >
            {label}
            {id === 'all' && artifacts.length ? (
              <span className="object-workspace-tab__count">{artifacts.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {!loading ? (
        <MediaGallery
          items={galleryItems}
          title="Gallery"
          emptyHint={
            artifacts.length === 0
              ? 'No artifacts yet. Click Discover / bootstrap to attach media from product sources.'
              : 'No assets match this filter.'
          }
        />
      ) : null}

      {/* Action cards under gallery for rights / analyze */}
      {filtered.length > 0 ? (
        <div className="media-workspace__actions-grid">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`media-artifact-card ${a.purpose === 'primary' ? 'is-primary' : ''}`}
            >
              <div className="media-artifact-card__meta">
                <strong>
                  {a.purpose}
                  {a.purpose === 'primary' ? ' ★' : ''}
                </strong>
                <span className="meta">{a.title || a.artifactType}</span>
                <span className="meta">
                  {a.rightsStatus} · {a.publicationStatus}
                  {a.width && a.height ? ` · ${a.width}×${a.height}` : ''}
                </span>
                <span
                  className={
                    a.provenanceLabel?.includes('FIXTURE') ? 'meta text-warning' : 'meta'
                  }
                >
                  {a.provenanceLabel}
                </span>
              </div>
              <div className="media-artifact-card__btns">
                {a.artifactType === 'image' ? (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy || a.purpose === 'primary'}
                    onClick={() => void setPrimary(a.id)}
                  >
                    Set primary
                  </button>
                ) : null}
                {a.contentUrl &&
                (a.artifactType === 'document' || a.artifactType === 'model_3d') ? (
                  <a
                    className="btn ghost"
                    href={resolveContentUrl(a.contentUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => void analyze(a.id)}
                >
                  Analyze
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
