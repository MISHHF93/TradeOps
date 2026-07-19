import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

type CommandCenter = {
  title?: string;
  principles?: string[];
  links?: Record<string, string>;
  platform?: {
    status?: string;
    uptimeSeconds?: number;
    dependencies?: Array<{ name: string; status: string; message?: string; latencyMs?: number }>;
  };
  ai?: {
    aiProvider?: string;
    runtimeConfigured?: boolean;
    searchEnabled?: boolean;
    cohereConfigured?: boolean;
    agents?: { agents?: Array<{ id: string; label: string; mission: string }> };
  };
  liveProjection?: {
    enabled?: boolean;
    transport?: string;
    maxItems?: number;
  };
  connectors?: {
    summary?: {
      total?: number;
      online?: number;
      offline?: number;
      fixtures?: number;
      needsCredentials?: number;
      unhealthy?: number;
    } | null;
    note?: string;
  };
  events?: {
    recent?: Array<{
      id: string;
      eventType: string;
      providerKey?: string | null;
      isFixture?: boolean;
      createdAt: string;
    }>;
    count?: number;
  };
  workload?: { openCases?: number; pendingApprovals?: number };
  queues?: { redis?: string; note?: string };
  architecture?: {
    layers?: string[];
    modules?: number;
    dataFabricEntities?: number;
    eventTypes?: number;
  };
  checkedAt?: string;
  note?: string;
};

/**
 * Operations Command Center — one COS visibility surface.
 * Composes health, connectors, AI, events, live projection, queues.
 */
export default async function OpsCommandCenterPage() {
  const res = await terminalGet<CommandCenter>('/api/v1/ops/command-center');

  if (!res.ok) {
    return (
      <section>
        <p className="form-error">{res.error}</p>
        <p className="meta">Ensure API and database are running.</p>
        <Link className="btn secondary" href="/terminal/connectors">
          Connector health
        </Link>
      </section>
    );
  }

  const d = res.data;
  const s = d.connectors?.summary;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Operations Command Center</p>
          <h1>{d.title ?? 'Ops Center'}</h1>
          <p className="lede">
            Single place for connector sensors, AI runtime, events, queues, and live projection —
            composed from existing fabrics, not a parallel stack.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href="/terminal/connectors">
            Connectors
          </Link>
          <Link className="btn ghost" href="/terminal/ecosystem">
            Ecosystem
          </Link>
          <Link className="btn ghost" href="/status">
            Capability board
          </Link>
        </div>
      </header>

      <p className="meta" style={{ marginBottom: 16 }}>
        Platform <strong>{d.platform?.status ?? '—'}</strong>
        {typeof d.platform?.uptimeSeconds === 'number'
          ? ` · uptime ${d.platform.uptimeSeconds}s`
          : ''}
        {d.checkedAt ? ` · checked ${d.checkedAt}` : ''}
      </p>

      {d.principles?.length ? (
        <ul className="meta" style={{ marginBottom: 16 }}>
          {d.principles.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Dependencies</h2>
          <ul className="kv">
            {(d.platform?.dependencies ?? []).map((dep) => (
              <li key={dep.name}>
                <span>{dep.name}</span>
                <strong>
                  {dep.status}
                  {typeof dep.latencyMs === 'number' ? ` · ${dep.latencyMs}ms` : ''}
                </strong>
              </li>
            ))}
          </ul>
          {d.queues?.note ? <p className="meta">{d.queues.note}</p> : null}
        </article>

        <article className="panel">
          <h2>Connectors</h2>
          {s ? (
            <ul className="kv">
              <li>
                <span>Total</span>
                <strong>{s.total ?? '—'}</strong>
              </li>
              <li>
                <span>Online</span>
                <strong>{s.online ?? '—'}</strong>
              </li>
              <li>
                <span>Need credentials</span>
                <strong>{s.needsCredentials ?? '—'}</strong>
              </li>
              <li>
                <span>Fixtures</span>
                <strong>{s.fixtures ?? '—'}</strong>
              </li>
              <li>
                <span>Unhealthy</span>
                <strong>{s.unhealthy ?? '—'}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">{d.connectors?.note ?? 'No summary'}</p>
          )}
          <Link className="btn ghost" href="/terminal/connectors">
            Open connector sensors
          </Link>
        </article>

        <article className="panel">
          <h2>AI runtime</h2>
          <ul className="kv">
            <li>
              <span>Provider</span>
              <strong>{d.ai?.aiProvider ?? '—'}</strong>
            </li>
            <li>
              <span>Configured</span>
              <strong>{d.ai?.runtimeConfigured ? 'yes' : 'no'}</strong>
            </li>
            <li>
              <span>Cohere</span>
              <strong>{d.ai?.cohereConfigured ? 'yes' : 'no'}</strong>
            </li>
            <li>
              <span>Web search</span>
              <strong>{d.ai?.searchEnabled ? 'on' : 'off'}</strong>
            </li>
            <li>
              <span>Live projection</span>
              <strong>
                {d.liveProjection?.enabled ? 'on' : 'off'} · {d.liveProjection?.transport ?? 'sse'}
              </strong>
            </li>
          </ul>
          <Link className="btn ghost" href="/terminal/ai">
            AI operator
          </Link>{' '}
          <Link className="btn ghost" href="/terminal">
            Live search
          </Link>
        </article>

        <article className="panel">
          <h2>Workload</h2>
          <ul className="kv">
            <li>
              <span>Open cases</span>
              <strong>{d.workload?.openCases ?? '—'}</strong>
            </li>
            <li>
              <span>Pending approvals</span>
              <strong>{d.workload?.pendingApprovals ?? '—'}</strong>
            </li>
            <li>
              <span>Redis / queues</span>
              <strong>{d.queues?.redis ?? '—'}</strong>
            </li>
          </ul>
          <Link className="btn ghost" href="/terminal/process">
            Process board
          </Link>
        </article>

        <article className="panel">
          <h2>Architecture</h2>
          <ul className="kv">
            <li>
              <span>Layers</span>
              <strong>{d.architecture?.layers?.length ?? '—'}</strong>
            </li>
            <li>
              <span>Modules</span>
              <strong>{d.architecture?.modules ?? '—'}</strong>
            </li>
            <li>
              <span>Data fabric entities</span>
              <strong>{d.architecture?.dataFabricEntities ?? '—'}</strong>
            </li>
            <li>
              <span>Event types</span>
              <strong>{d.architecture?.eventTypes ?? '—'}</strong>
            </li>
          </ul>
          <p className="meta">GET /api/v1/health/architecture</p>
        </article>

        <article className="panel">
          <h2>Agent roles</h2>
          <ul className="meta">
            {(d.ai?.agents?.agents ?? []).slice(0, 8).map((a) => (
              <li key={a.id}>
                <strong>{a.label}</strong> — {a.mission}
              </li>
            ))}
          </ul>
          <p className="meta">One runtime · multiple specialist roles</p>
        </article>
      </div>

      <h2 style={{ marginTop: 24 }}>Recent events</h2>
      {(d.events?.recent?.length ?? 0) === 0 ? (
        <p className="meta">No durable events yet. Live search, webhooks, and AI runs will appear here.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Provider</th>
              <th>When</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {(d.events?.recent ?? []).map((e) => (
              <tr key={e.id}>
                <td>{e.eventType}</td>
                <td>{e.providerKey ?? '—'}</td>
                <td className="meta">{String(e.createdAt)}</td>
                <td>{e.isFixture ? 'fixture' : 'live'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {d.note ? <p className="meta" style={{ marginTop: 16 }}>{d.note}</p> : null}
    </section>
  );
}
