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

  return (
    <section>
      <ProcessPageHeader
        pill="Ops Center · connectors as live sensors"
        title="Connector Health Center"
        lede="Every integration is an operational sensor for the Commerce Runtime. AI requests business capabilities — never vendor REST paths. Live providers need OAuth/API keys; fixtures are labeled."
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'Connectors' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn ghost" href="/terminal/integrations">
              Integration hub
            </Link>
            <Link className="btn ghost" href="/terminal/ecosystem">
              Capability graph
            </Link>
            <Link className="btn ghost" href="/terminal/live-examples">
              Live examples
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      {h.honesty?.note ? <p className="meta">{h.honesty.note}</p> : null}

      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Registry</h2>
          <strong className="text-accent" style={{ fontSize: '1.6rem' }}>
            {s.total}
          </strong>
          <p className="meta">providers catalogued</p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Online</h2>
          <strong style={{ fontSize: '1.6rem' }}>{s.online}</strong>
          <p className="meta">
            {s.liveConnected} live · {s.fixtures} fixture
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
          Org installations: {installs.data.length} (fixtures auto-bootstrap for Discover)
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
                  <tr key={c.providerKey}>
                    <td>
                      {c.vendor}
                      {c.isFixture ? ' · FIXTURE' : ''}
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
                  {e.isFixture ? ' · FIXTURE' : ''}
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
