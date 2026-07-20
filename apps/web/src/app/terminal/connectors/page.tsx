import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { ConnectorProbeButton } from '../../../components/connectors/connector-probe-button';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type HealthCenter = {
  summary: {
    total: number;
    online: number;
    offline: number;
    fixtures: number;
    liveConnected: number;
    needsCredentials: number;
    unhealthy: number;
    webhookOk: number;
    avgLatencyMs: number | null;
  };
  byDomain: Array<{
    domain: string;
    label: string;
    connectors: Array<{
      providerKey: string;
      vendor: string;
      displayName: string;
      domain: string;
      authenticationMethod: string;
      oauthStatus: string;
      apiVersion: string;
      supportedCapabilities: string[];
      healthStatus: string;
      online: boolean;
      latencyMs: number | null;
      synchronizationStatus: string;
      isFixture: boolean;
      docsUrl: string;
      notes: string;
      observability: {
        webhookHealth: string;
        lastSuccessAt: string | null;
        errorRate: number;
        retryCount: number;
      };
    }>;
  }>;
  honesty?: { note?: string };
  eventBus?: {
    standardEvents: string[];
    recent: Array<{
      id: string;
      eventType: string;
      providerKey: string | null;
      isFixture: boolean;
      createdAt: string;
    }>;
    note?: string;
  };
  tracing?: { standard?: string; note?: string };
};

/**
 * Real-Time Commerce Operations Center — connector sensors + health.
 */
export default async function ConnectorsOpsPage() {
  const health = await terminalGet<HealthCenter>('/api/v1/ops/connectors/health');
  const installs = await terminalGet<
    Array<{ providerKey: string; status: string; isFixture: boolean }>
  >('/api/v1/connectors');
  const fabric = await terminalGet<{
    planned?: Array<{
      providerKey: string;
      displayName: string;
      maturity: string;
      notes?: string;
    }>;
    honesty?: { note?: string };
  }>('/api/v1/ops/connectors/fabric');
  const envHealth = await terminalGet<{
    providers?: Array<{ name?: string; status?: string; configured?: boolean }>;
    environment?: {
      providers?: Array<{ name?: string; status?: string; configured?: boolean }>;
    };
  }>('/api/v1/health/environment');

  if (!health.ok) {
    return (
      <section>
        <p className="form-error">{health.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const h = health.data;
  const s = h.summary;
  const planned = fabric.ok ? fabric.data.planned ?? [] : [];

  const liveMode = s.liveConnected > 0;
  const demoMode = !liveMode && s.fixtures > 0;
  const envProviders =
    envHealth.ok
      ? (envHealth.data.providers ??
          envHealth.data.environment?.providers ??
          [])
      : [];
  const envConfigured = (needle: RegExp) =>
    envProviders.some(
      (p) =>
        needle.test(String(p.name ?? '')) &&
        (p.configured === true ||
          /configured|healthy|ok/i.test(String(p.status ?? ''))),
    );
  const shopifyReady = envConfigured(/shopify/i);
  const amazonReady = envConfigured(/amazon|sp.?api|lwa/i);
  const tavilyReady = envConfigured(/tavily/i);
  const cohereReady = envConfigured(/cohere/i);

  return (
    <section className="connections-page">
      <ProcessPageHeader
        pill="Connections · go live"
        title="Connections"
        lede="Link suppliers and storefronts when you leave demo mode. AI market research works without live OAuth — connectors unlock inventory, orders, and publish."
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Home' },
          { label: 'Connections' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/workspace">
              Open AI on Home
            </Link>
            <Link className="btn secondary" href="/terminal/process">
              Cases
            </Link>
            <Link className="btn ghost" href="/terminal/integrations">
              Integration hub
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      <article
        id="shopify-path"
        className="panel connections-golive"
        style={{ marginBottom: 16 }}
      >
        <div className="connections-golive__head">
          <span className="object-workspace__type">
            {liveMode ? 'Live mode' : demoMode ? 'Demo mode' : 'Not connected'}
          </span>
          <h2 style={{ margin: '4px 0 8px' }}>
            {liveMode
              ? `${s.liveConnected} live connection${s.liveConnected === 1 ? '' : 's'}`
              : 'Go live when you are ready'}
          </h2>
          <p className="meta" style={{ margin: 0 }}>
            {liveMode
              ? 'Live providers feed the Commerce Runtime. Keep fixtures labeled for rehearsal only.'
              : 'You can research products with AI today. Connect a storefront or supplier to import real inventory and advance live cases.'}
          </p>
        </div>

        <div className="connections-first-path" style={{ marginBottom: 14 }}>
          <p className="meta" style={{ margin: '0 0 6px' }}>
            First live path readiness (env only — no secrets shown)
          </p>
          <ul className="connections-env-grid">
            <li className={cohereReady ? 'is-ready' : ''}>
              <strong>Cohere</strong>
              <span className="meta">{cohereReady ? 'configured' : 'missing COHERE_API_KEY'}</span>
            </li>
            <li className={tavilyReady ? 'is-ready' : ''}>
              <strong>Tavily search</strong>
              <span className="meta">{tavilyReady ? 'configured' : 'optional TAVILY_API_KEY'}</span>
            </li>
            <li className={shopifyReady ? 'is-ready' : ''}>
              <strong>Shopify (first live path)</strong>
              <span className="meta">
                {shopifyReady
                  ? 'env present — Probe shopify-graphql-admin below, then import from Discover'
                  : 'Add SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN to root .env. Restart API. Never paste secrets in UI.'}
              </span>
            </li>
            <li className={amazonReady ? 'is-ready' : ''}>
              <strong>Amazon</strong>
              <span className="meta">
                {amazonReady
                  ? 'env present — probe below'
                  : 'Optional later: AMAZON_SP_API_* / LWA credentials in .env'}
              </span>
            </li>
          </ul>
          {!shopifyReady ? (
            <p className="meta connections-shopify-hint" style={{ margin: '8px 0 0' }}>
              Recommended: <strong>AI research → Prepare go-live → Approve &amp; push</strong>{' '}
              (explicit productCreate as Shopify DRAFT when env ready; dry-run without). See{' '}
              <Link href="/status">Status</Link> for env matrix.
            </p>
          ) : (
            <p className="meta connections-shopify-hint" style={{ margin: '8px 0 0' }}>
              Shopify credentials detected. AI rail <strong>Prepare Shopify go-live</strong> will
              probe read-only · queue approval. Then Probe row below → Discover import.
            </p>
          )}
        </div>

        <ol className="connections-checklist">
          <li className={s.liveConnected > 0 ? 'is-done' : ''}>
            <strong>1. Pick a path</strong>
            <span className="meta">
              Recommended: AI research → Draft listing → Prepare Shopify go-live → Approvals
            </span>
          </li>
          <li className={shopifyReady || amazonReady ? 'is-done' : ''}>
            <strong>2. Put keys in root <code>.env</code></strong>
            <span className="meta">
              Typical: <code>SHOPIFY_*</code>, <code>AMAZON_*</code>, or supplier HTTP credentials.
              Never paste secrets into the UI. Restart API after changes.
            </span>
          </li>
          <li>
            <strong>3. Probe &amp; install</strong>
            <span className="meta">
              Use Probe on a row below, confirm Health = connected, then import products from Discover.
            </span>
          </li>
          <li className={demoMode ? '' : 'is-done'}>
            <strong>4. Leave demo catalog</strong>
            <span className="meta">
              Seed fixtures stay labeled. Research saves use <code>ai-research</code> platform (not fixture).
            </span>
          </li>
        </ol>
        <div className="connections-golive__actions">
          <Link className="btn primary" href="/terminal/workspace">
            Research with AI (no OAuth)
          </Link>
          <Link className="btn secondary" href="/terminal/process">
            Open Cases
          </Link>
          <Link className="btn ghost" href="/status">
            Env / status
          </Link>
          <Link className="btn ghost" href="/terminal/live-examples">
            Live examples
          </Link>
        </div>
      </article>

      {h.honesty?.note ? <p className="meta">{h.honesty.note}</p> : null}

      <div className="detail-grid connections-kpis" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Registry</h2>
          <strong className="text-accent" style={{ fontSize: '1.6rem' }}>
            {s.total}
          </strong>
          <p className="meta">providers catalogued</p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Live</h2>
          <strong style={{ fontSize: '1.6rem' }}>{s.liveConnected}</strong>
          <p className="meta">
            {s.online} online · {s.fixtures} demo
          </p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Needs credentials</h2>
          <strong className={s.needsCredentials ? 'text-warning' : ''} style={{ fontSize: '1.6rem' }}>
            {s.needsCredentials}
          </strong>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Webhooks OK</h2>
          <strong style={{ fontSize: '1.6rem' }}>{s.webhookOk}</strong>
          <p className="meta">avg latency {s.avgLatencyMs ?? '—'} ms</p>
        </article>
      </div>

      {installs.ok ? (
        <p className="meta" style={{ marginBottom: 12 }}>
          Org installations: {installs.data.length}
          {s.fixtures > 0 ? ' · demo fixtures present for walkthroughs' : ''}
        </p>
      ) : null}

      {h.byDomain.map((d) => (
        <article key={d.domain} className="panel wide" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{d.label}</h2>
          <div className="table-wrap">
            <table className="compact">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Provider</th>
                  <th>Auth</th>
                  <th>OAuth</th>
                  <th>Health</th>
                  <th>Sync</th>
                  <th>Webhooks</th>
                  <th>Capabilities</th>
                  <th>Latency</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.connectors.map((c) => (
                  <tr
                    key={c.providerKey}
                    id={
                      c.providerKey === 'shopify-graphql-admin'
                        ? 'shopify-graphql-admin'
                        : undefined
                    }
                    className={
                      c.providerKey === 'shopify-graphql-admin'
                        ? 'connections-row--featured'
                        : undefined
                    }
                  >
                    <td>
                      {c.vendor}
                      {c.isFixture ? ' · Demo' : ''}
                      {c.providerKey === 'shopify-graphql-admin' ? (
                        <div className="meta">First live path</div>
                      ) : null}
                    </td>
                    <td>
                      <a href={c.docsUrl} target="_blank" rel="noreferrer">
                        {c.displayName}
                      </a>
                      <div className="meta">{c.apiVersion}</div>
                    </td>
                    <td>{c.authenticationMethod}</td>
                    <td>{c.oauthStatus}</td>
                    <td className={c.online ? '' : 'text-warning'}>{c.healthStatus}</td>
                    <td>{c.synchronizationStatus}</td>
                    <td>{c.observability.webhookHealth}</td>
                    <td className="meta" style={{ whiteSpace: 'normal', maxWidth: 220 }}>
                      {c.supportedCapabilities.slice(0, 4).join(', ') || '—'}
                      {c.supportedCapabilities.length > 4
                        ? ` +${c.supportedCapabilities.length - 4}`
                        : ''}
                    </td>
                    <td>{c.latencyMs != null ? `${c.latencyMs}ms` : '—'}</td>
                    <td>
                      <ConnectorProbeButton providerKey={c.providerKey} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta" style={{ marginTop: 8 }}>
            {d.connectors[0]?.notes}
          </p>
        </article>
      ))}

      {planned.length > 0 ? (
        <article className="panel wide" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Planned integrations</h2>
          <p className="meta">
            Roadmap only — not operational, not connected, no credential forms, no live metrics.
          </p>
          <ul className="meta">
            {planned.map((p) => (
              <li key={p.providerKey}>
                <strong>{p.displayName}</strong> ({p.providerKey}) · {p.maturity}
                {p.notes ? ` — ${p.notes}` : ''}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {h.eventBus ? (
        <article className="panel wide" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Event bus</h2>
          <p className="meta">{h.eventBus.note}</p>
          <p className="meta">
            Standard events: {h.eventBus.standardEvents.slice(0, 10).join(', ')}…
          </p>
          {h.eventBus.recent.length === 0 ? (
            <p className="meta">No connector events yet. Probe a connector or run a transform.</p>
          ) : (
            <ul className="meta">
              {h.eventBus.recent.slice(0, 12).map((e) => (
                <li key={e.id}>
                  {e.createdAt} · {e.eventType}
                  {e.providerKey ? ` · ${e.providerKey}` : ''}
                  {e.isFixture ? ' · Demo' : ''}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {h.tracing ? (
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Observability</h2>
          <p className="meta">
            Tracing standard: {h.tracing.standard}. {h.tracing.note}
          </p>
        </article>
      ) : null}
    </section>
  );
}
