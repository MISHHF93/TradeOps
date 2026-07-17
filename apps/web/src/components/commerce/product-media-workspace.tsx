'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

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

/**
 * Product Media Workspace — first-class Digital Twin artifacts.
 */
export function ProductMediaWorkspace({ productId }: { productId: string }) {
  const [data, setData] = useState<ArtifactsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts`,
        { credentials: 'include', headers: { Accept: 'application/json' } },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      setData(body as ArtifactsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load artifacts');
    }
  }, [productId]);

  useEffect(() => {
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
      const proposal = (body as { proposal?: { analysis?: Record<string, unknown>; confidence?: number } })
        .proposal;
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

  const g = data?.channelReadiness?.google;

  return (
    <article className="panel wide" style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Product media &amp; artifacts</h2>
          <p className="meta" style={{ margin: '4px 0 0' }}>
            First-class Digital Twin media — provenance, rights, and channel readiness. Not a
            decorative gallery.
          </p>
        </div>
        <div className="terminal-toolbar">
          <button type="button" className="btn ai" disabled={busy} onClick={() => void bootstrap()}>
            {busy ? 'Working…' : 'Discover / bootstrap artifacts'}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {msg ? <p className="meta text-accent">{msg}</p> : null}
      {data?.honesty?.note ? <p className="meta">{data.honesty.note}</p> : null}

      {data ? (
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Completeness</h3>
            <p>
              Score: <strong className="text-accent">{data.completeness.score}/100</strong>
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
          <div className="panel" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Google Merchant readiness</h3>
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
              <ul className="meta">
                {g.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
            {g?.recommendedCorrections?.length ? (
              <ul className="meta">
                {g.recommendedCorrections.map((c) => (
                  <li key={c}>→ {c}</li>
                ))}
              </ul>
            ) : null}
            <p className="meta">{data.channelReadiness.shopify.note}</p>
            <p className="meta">{data.channelReadiness.ebay.note}</p>
            {data.channelReadiness.amazon ? (
              <p className="meta">
                Amazon: {data.channelReadiness.amazon.publishStatus} · local images{' '}
                {data.channelReadiness.amazon.localReadyImages ?? 0}
              </p>
            ) : null}
          </div>
          {(data.duplicates?.exact?.length || data.duplicates?.near?.length) ? (
            <div className="panel" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Duplicate relationships</h3>
              <p className="meta">Shown as relationships — not auto-deleted.</p>
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

      <div className="scanner-filters" style={{ marginTop: 12 }}>
        <input
          type="url"
          placeholder="Ingest authorized https image/PDF URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          style={{ minWidth: 280, flex: 1 }}
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        {(data?.artifacts ?? []).map((a) => (
          <div
            key={a.id}
            className="panel"
            style={{ padding: 10, display: 'relative' }}
            data-selected={a.purpose === 'primary' ? 'true' : undefined}
          >
            {a.artifactType === 'image' && a.contentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${getApiBaseUrl()}${a.contentUrl}`}
                alt={a.altText ?? a.title ?? 'Product artifact'}
                style={{
                  width: '100%',
                  height: 140,
                  objectFit: 'contain',
                  background: 'var(--color-surface-2)',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-subtle)',
                }}
              />
            ) : (
              <div
                style={{
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-surface-2)',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 12,
                  color: 'var(--color-text-tertiary)',
                  padding: 8,
                  textAlign: 'center',
                }}
              >
                {a.artifactType} · {a.purpose}
              </div>
            )}
            <p style={{ margin: '8px 0 2px', fontSize: 12, fontWeight: 600 }}>
              {a.purpose}
              {a.purpose === 'primary' ? ' ★' : ''}
            </p>
            <p className="meta" style={{ margin: 0, fontSize: 11 }}>
              {a.title}
            </p>
            <p className="meta" style={{ margin: '4px 0 0', fontSize: 10 }}>
              {a.rightsStatus} · {a.publicationStatus}
              {a.width && a.height ? ` · ${a.width}×${a.height}` : ''}
            </p>
            <p className="meta" style={{ margin: '2px 0 0', fontSize: 10 }}>
              <span className={a.provenanceLabel?.includes('FIXTURE') ? 'text-warning' : undefined}>
                {a.provenanceLabel}
              </span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {a.artifactType === 'image' ? (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ minHeight: 26, fontSize: 11 }}
                  disabled={busy || a.purpose === 'primary'}
                  onClick={() => void setPrimary(a.id)}
                >
                  Set primary
                </button>
              ) : null}
              {a.contentUrl && (a.artifactType === 'document' || a.artifactType === 'model_3d') ? (
                <a
                  className="btn ghost"
                  style={{ minHeight: 26, fontSize: 11, display: 'inline-flex' }}
                  href={`${getApiBaseUrl()}${a.contentUrl}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              ) : null}
              <button
                type="button"
                className="btn ghost"
                style={{ minHeight: 26, fontSize: 11 }}
                disabled={busy}
                onClick={() => void analyze(a.id)}
              >
                Analyze (proposal)
              </button>
            </div>
          </div>
        ))}
      </div>

      {data && data.artifacts.length === 0 ? (
        <p className="meta" style={{ marginTop: 12 }}>
          No artifacts yet. Click <strong>Discover / bootstrap artifacts</strong> to attach a
          primary image, gallery, packaging, spec sheet, and manual stubs from product sources.
        </p>
      ) : null}
    </article>
  );
}
