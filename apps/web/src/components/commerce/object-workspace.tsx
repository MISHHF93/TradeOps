'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AskAiButton } from '../ai/ask-ai-button';
import { MediaGallery, type MediaGalleryItem } from './media-gallery';

export type ObjectWorkspacePanelDto = {
  id: string;
  label: string;
  description: string;
  empty?: boolean;
  items?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    href?: string;
    meta?: Record<string, unknown>;
  }>;
  summary?: Record<string, unknown>;
};

export type ObjectWorkspaceDto = {
  objectType: string;
  objectId: string;
  title: string;
  subtitle: string;
  stage?: string;
  stageStatus?: string;
  nextAction?: { code?: string | null; label?: string | null; href?: string | null };
  blocker?: { code?: string | null; message?: string | null };
  panels: ObjectWorkspacePanelDto[];
  related: Array<{ type: string; id: string; label: string; href: string; isFixture?: boolean }>;
  graph?: {
    nodes: Array<{ type: string; id: string; label: string; href?: string }>;
    edges: Array<{ relation: string }>;
  };
  aiContext?: {
    preamble: string;
    suggestedObjective: string;
    tools: string[];
  };
  honesty?: { note: string; isFixtureSource: boolean };
  /** Optional hero media when API provides product images */
  heroMedia?: Array<{ id?: string; url: string; label?: string; purpose?: string }>;
  productId?: string;
};

const PRIORITY_PANELS = [
  'overview',
  'next_action',
  'lifecycle',
  'research',
  'suppliers',
  'pricing',
  'media',
  'opportunities',
  'listings',
  'orders',
  'shipments',
  'payments',
  'ai',
  'approvals',
  'signals',
  'relationships',
  'history',
];

function mediaFromPanel(panel?: ObjectWorkspacePanelDto): MediaGalleryItem[] {
  if (!panel?.items?.length) return [];
  const out: MediaGalleryItem[] = [];
  for (const item of panel.items) {
    const m = item.meta ?? {};
    const url =
      (typeof m.url === 'string' && m.url) ||
      (typeof m.contentUrl === 'string' && m.contentUrl) ||
      (typeof m.imageUrl === 'string' && m.imageUrl) ||
      (typeof m.src === 'string' && m.src) ||
      null;
    if (!url) continue;
    out.push({
      id: item.id,
      src: url.startsWith('http') || url.startsWith('/') ? url : url,
      alt: item.title,
      label: item.subtitle || item.title,
      badge: typeof m.purpose === 'string' ? m.purpose : undefined,
      kind:
        m.kind === 'video'
          ? 'video'
          : m.kind === 'document'
            ? 'document'
            : 'image',
    });
  }
  return out;
}

function mediaFromHero(
  hero?: ObjectWorkspaceDto['heroMedia'],
): MediaGalleryItem[] {
  if (!hero?.length) return [];
  return hero
    .filter((h) => h.url)
    .map((h, i) => ({
      id: h.id ?? `hero-${i}`,
      src: h.url,
      alt: h.label ?? h.purpose ?? 'Product media',
      label: h.label ?? h.purpose,
      badge: h.purpose,
      kind: 'image' as const,
    }));
}

/**
 * Object-centric OS surface — modern workspace for Case / Product hubs.
 * Loads facets, media, related graph, and contextual AI entry.
 */
export function ObjectWorkspace({
  workspace,
  section,
}: {
  workspace: ObjectWorkspaceDto;
  section?: string;
}) {
  const order = useMemo(
    () => new Map(PRIORITY_PANELS.map((id, i) => [id, i])),
    [],
  );
  const panels = useMemo(
    () =>
      [...workspace.panels].sort(
        (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
      ),
    [workspace.panels, order],
  );

  const focus = section ? panels.find((p) => p.id === section) ?? null : null;
  const mediaPanel = panels.find((p) => p.id === 'media');
  const galleryItems = useMemo(() => {
    const fromHero = mediaFromHero(workspace.heroMedia);
    const fromPanel = mediaFromPanel(mediaPanel);
    const seen = new Set<string>();
    const merged: MediaGalleryItem[] = [];
    for (const it of [...fromHero, ...fromPanel]) {
      if (seen.has(it.src)) continue;
      seen.add(it.src);
      merged.push(it);
    }
    return merged;
  }, [workspace.heroMedia, mediaPanel]);

  const visiblePanels = focus
    ? [focus]
    : panels.filter((p) => !p.empty || p.summary || (p.items && p.items.length > 0));

  const caseId =
    workspace.objectType === 'commerce_case' || workspace.objectType === 'case'
      ? workspace.objectId
      : undefined;

  const aiObjective =
    workspace.aiContext?.suggestedObjective?.trim() ||
    workspace.nextAction?.label ||
    `Work on ${workspace.title}`;

  return (
    <div className="object-workspace object-workspace--modern">
      {(workspace.honesty?.isFixtureSource || workspace.honesty?.note) && (
        <div className="object-workspace__honesty" role="status">
          {workspace.honesty.isFixtureSource ? (
            <span className="badge badge-warning">TEST FIXTURE</span>
          ) : null}
          <span className="meta">
            {workspace.honesty.note ||
              'Fixture source — same connector contract as live; not a production API claim.'}
          </span>
        </div>
      )}

      {workspace.blocker?.message ? (
        <div className="object-workspace__blocker" role="alert">
          <strong>Blocked</strong>
          <p>{workspace.blocker.message}</p>
        </div>
      ) : null}

      <header className="object-workspace__hero">
        <div className="object-workspace__hero-main">
          <div className="object-workspace__identity">
            <span className="object-workspace__type">{workspace.objectType.replace(/_/g, ' ')}</span>
            {workspace.stage ? (
              <span className="object-workspace__stage">
                {workspace.stage}
                {workspace.stageStatus ? ` · ${workspace.stageStatus}` : ''}
              </span>
            ) : null}
          </div>
          <h2 className="object-workspace__title">{workspace.title}</h2>
          <p className="object-workspace__subtitle">{workspace.subtitle}</p>
          {workspace.aiContext?.preamble ? (
            <p className="object-workspace__preamble meta">{workspace.aiContext.preamble}</p>
          ) : null}
        </div>
        <div className="object-workspace__hero-actions">
          {workspace.nextAction?.label ? (
            workspace.nextAction.href ? (
              <Link className="btn primary" href={workspace.nextAction.href}>
                {workspace.nextAction.label}
              </Link>
            ) : (
              <span className="btn primary" style={{ pointerEvents: 'none', opacity: 0.85 }}>
                {workspace.nextAction.label}
              </span>
            )
          ) : null}
          <AskAiButton
            objective={aiObjective}
            commerceCaseId={caseId}
            label="Ask AI about this"
          />
        </div>
      </header>

      {galleryItems.length > 0 ? (
        <section className="object-workspace__media-band" aria-label="Media">
          <MediaGallery items={galleryItems} title="Media" />
        </section>
      ) : null}

      <nav className="object-workspace-tabs" aria-label="Object workspace sections">
        <Link
          href="?"
          className={!focus ? 'object-workspace-tab is-active' : 'object-workspace-tab'}
        >
          All
        </Link>
        {panels.map((p) => {
          const href = `?section=${encodeURIComponent(p.id)}`;
          const active = focus?.id === p.id;
          const count = p.items?.length;
          return (
            <Link
              key={p.id}
              href={href}
              className={active ? 'object-workspace-tab is-active' : 'object-workspace-tab'}
            >
              {p.label}
              {count ? <span className="object-workspace-tab__count">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="object-workspace__grid detail-grid">
        {visiblePanels.map((p) => {
          const isWide =
            p.id === 'lifecycle' ||
            p.id === 'history' ||
            p.id === 'relationships' ||
            p.id === 'media' ||
            p.id === 'overview';
          const isMedia = p.id === 'media';
          const panelMedia = isMedia ? mediaFromPanel(p) : [];

          return (
            <article
              key={p.id}
              className={`panel object-panel ${isWide ? 'wide' : ''} ${p.empty ? 'object-panel--empty' : ''}`}
              id={`section-${p.id}`}
            >
              <header className="object-panel__head">
                <h3 className="object-panel__title">{p.label}</h3>
                <p className="object-panel__desc meta">{p.description}</p>
              </header>

              {isMedia && panelMedia.length > 0 ? (
                <MediaGallery items={panelMedia} dense title={p.label} />
              ) : null}

              {p.summary ? (
                <ul className="kv object-panel__kv">
                  {Object.entries(p.summary)
                    .filter(([, v]) => v != null && v !== '')
                    .slice(0, 16)
                    .map(([k, v]) => (
                      <li key={k}>
                        <span>{formatKey(k)}</span>
                        <strong>
                          {typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v)}
                        </strong>
                      </li>
                    ))}
                </ul>
              ) : null}

              {p.items && p.items.length > 0 && !isMedia ? (
                <ul className="object-panel__list">
                  {p.items.map((item) => (
                    <li key={item.id} className="object-panel__item">
                      {item.href ? (
                        <Link href={item.href} className="object-panel__item-link">
                          <strong>{item.title}</strong>
                        </Link>
                      ) : (
                        <strong>{item.title}</strong>
                      )}
                      {item.subtitle ? (
                        <span className="meta object-panel__item-sub">{item.subtitle}</span>
                      ) : null}
                      {item.meta && Object.keys(item.meta).length > 0 ? (
                        <span className="meta object-panel__item-meta">
                          {Object.entries(item.meta)
                            .filter(
                              ([, v]) =>
                                v != null &&
                                typeof v !== 'object' &&
                                !String(v).startsWith('http'),
                            )
                            .slice(0, 4)
                            .map(([k, v]) => `${formatKey(k)}: ${String(v)}`)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {p.empty && !p.summary && !(p.items && p.items.length) ? (
                <p className="meta object-panel__empty">No records yet for this facet.</p>
              ) : null}
            </article>
          );
        })}
      </div>

      {workspace.graph && workspace.graph.nodes.length > 0 ? (
        <section className="object-workspace__graph panel wide">
          <h3 className="object-panel__title">Knowledge graph</h3>
          <p className="meta">
            {workspace.graph.nodes.length} nodes · {workspace.graph.edges?.length ?? 0} relations
          </p>
          <div className="object-graph-nodes">
            {workspace.graph.nodes.slice(0, 24).map((n) =>
              n.href ? (
                <Link key={`${n.type}:${n.id}`} href={n.href} className="object-graph-chip">
                  <span className="object-graph-chip__type">{n.type}</span>
                  {n.label}
                </Link>
              ) : (
                <span key={`${n.type}:${n.id}`} className="object-graph-chip">
                  <span className="object-graph-chip__type">{n.type}</span>
                  {n.label}
                </span>
              ),
            )}
          </div>
        </section>
      ) : null}

      {workspace.related?.length ? (
        <section className="object-workspace__related">
          <h3 className="object-panel__title">Related</h3>
          <div className="object-related-row">
            {workspace.related.map((r) => (
              <Link key={r.id} href={r.href} className="object-related-card">
                <span className="object-related-card__type">
                  {r.type}
                  {r.isFixture ? ' · fixture' : ''}
                </span>
                <strong>{r.label}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatKey(k: string): string {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s+/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
