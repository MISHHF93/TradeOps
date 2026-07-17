import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { PROCESS_LABELS } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type ProductionCatalog = {
  catalog: {
    connectors: Array<{
      id: string;
      provider: string;
      displayName: string;
      category: string;
      domain: string;
      docsUrl: string;
      liveReady: boolean;
      missingKeys: string[];
      credentialEnvKeys: string[];
      authMethod: string;
      liveHttpImplemented?: boolean;
    }>;
    summary: {
      total: number;
      liveReady: number;
      credentialsRequired: number;
      httpImplemented: number;
    };
    honesty?: { note?: string };
  };
};

type SaasTenant = {
  organization?: { name?: string; planTier?: string; segment?: string };
  usage?: {
    period?: string;
    products?: number;
    connectors?: number;
    aiEvaluations?: number;
    workflowRuns?: number;
    seats?: number;
    stores?: number;
  };
  quotas?: Record<
    string,
    { current: number; limit: number; ok: boolean }
  >;
  entitlements?: { packs?: string[] };
};

type TenancyCtx = {
  organizationSlug?: string;
  role?: string;
  commerceMode?: string;
  featureFlags?: string[];
};

/**
 * Integration Hub — credential vault (env presence only) + usage quotas.
 * Never displays secret values — only whether KEY is set / missing.
 */
export default async function IntegrationsHubPage() {
  const [prod, saas, tenancy] = await Promise.all([
    terminalGet<ProductionCatalog>('/api/v1/ops/connectors/production'),
    terminalGet<SaasTenant>('/api/v1/saas/tenant'),
    terminalGet<TenancyCtx>('/api/v1/tenancy/context'),
  ]);

  if (!prod.ok) {
    return (
      <section>
        <p className="form-error">{prod.error}</p>
        <Link href="/terminal/connectors">Connector health</Link>
      </section>
    );
  }

  const catalog = prod.data.catalog;
  const summary = catalog.summary;
  const connectors = [...catalog.connectors].sort((a, b) => {
    if (a.liveReady !== b.liveReady) return a.liveReady ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const byDomain = new Map<string, typeof connectors>();
  for (const c of connectors) {
    const d = c.domain || c.category || 'other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(c);
  }

  const quotas = saas.ok ? saas.data.quotas : null;
  const usage = saas.ok ? saas.data.usage : null;
  const tenantSlug = tenancy.ok ? tenancy.data.organizationSlug : null;

  return (
    <section>
      <ProcessPageHeader
        pill="Integration Hub · credential vault"
        title="Integrations & credential vault"
        lede="Production connector registry with honest credential readiness. Secrets live only in server .env — this page never shows secret values, only which env keys are present or missing. Paste keys into root .env (see docs/env-api-keys.paste.env)."
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'Integrations' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/connectors">
              Health center
            </Link>
            <Link className="btn ghost" href="/terminal/ecosystem">
              Ecosystem
            </Link>
            <Link className="btn ghost" href="/status">
              Public honesty board
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      {catalog.honesty?.note ? <p className="meta">{catalog.honesty.note}</p> : null}
      {tenantSlug ? (
        <p className="meta">
          Tenant <strong>{tenantSlug}</strong>
          {tenancy.ok && tenancy.data.role ? ` · role ${tenancy.data.role}` : ''}
          {tenancy.ok && tenancy.data.commerceMode
            ? ` · ${tenancy.data.commerceMode}`
            : ''}
        </p>
      ) : null}

      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Registry</h2>
          <strong className="text-accent" style={{ fontSize: '1.6rem' }}>
            {summary.total}
          </strong>
          <p className="meta">vendors catalogued</p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Live ready</h2>
          <strong className="text-accent" style={{ fontSize: '1.6rem' }}>
            {summary.liveReady}
          </strong>
          <p className="meta">env credentials present</p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Need keys</h2>
          <strong style={{ fontSize: '1.6rem' }}>{summary.credentialsRequired}</strong>
          <p className="meta">missing one or more env vars</p>
        </article>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>HTTP adapters</h2>
          <strong style={{ fontSize: '1.6rem' }}>{summary.httpImplemented}</strong>
          <p className="meta">live HTTP implemented (others registry-only)</p>
        </article>
      </div>

      {quotas ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Usage & quotas</h2>
          <p className="meta">
            Period {usage?.period ?? '—'} · plan{' '}
            {saas.ok ? saas.data.organization?.planTier ?? '—' : '—'}
          </p>
          <div className="detail-grid">
            {Object.entries(quotas).map(([key, q]) => (
              <div key={key}>
                <p className="meta" style={{ margin: 0, textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1')}
                </p>
                <strong>
                  {q.current}
                  <span className="meta"> / {q.limit}</span>
                </strong>
                {!q.ok ? (
                  <span className="pill" style={{ marginLeft: 8 }}>
                    at limit
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 12 }}>
            Stripe card charges are not enabled without <code>STRIPE_SECRET_KEY</code>. Meters
            still track usage for plan honesty.
          </p>
        </article>
      ) : null}

      <article className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>How to add keys</h2>
        <ol className="meta" style={{ lineHeight: 1.6 }}>
          <li>
            Open <code>docs/env-api-keys.paste.env</code> or root <code>env.vendors.template</code>
          </li>
          <li>
            Paste secrets after <code>=</code> (e.g. <code>XAI_API_KEY=xai-…</code>)
          </li>
          <li>
            Copy into root <code>.env</code>, then <code>pnpm stop</code> && <code>pnpm start</code>
          </li>
          <li>Refresh this page — live ready count should rise when keys are present</li>
        </ol>
      </article>

      {[...byDomain.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([domain, list]) => (
          <article key={domain} className="panel" style={{ marginBottom: 12 }}>
            <h2 style={{ marginTop: 0, textTransform: 'capitalize' }}>
              {domain.replace(/_/g, ' ')}
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Auth</th>
                    <th>Env keys</th>
                    <th>Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.displayName}</strong>
                        <div className="meta">{c.provider}</div>
                      </td>
                      <td>
                        {c.liveReady ? (
                          <span className="pill" style={{ background: 'var(--ok, #1a4)' }}>
                            credentials present
                          </span>
                        ) : (
                          <span className="pill">needs credentials</span>
                        )}
                      </td>
                      <td className="meta">{c.authMethod}</td>
                      <td>
                        {(c.credentialEnvKeys || []).map((k) => {
                          const missing = (c.missingKeys || []).includes(k);
                          return (
                            <code
                              key={k}
                              style={{
                                display: 'inline-block',
                                margin: '2px 4px 2px 0',
                                opacity: missing ? 0.55 : 1,
                                textDecoration: missing ? 'none' : undefined,
                              }}
                              title={missing ? 'Missing in process env' : 'Present in process env'}
                            >
                              {k}
                              {missing ? ' ✗' : ' ✓'}
                            </code>
                          );
                        })}
                      </td>
                      <td>
                        {c.docsUrl ? (
                          <a href={c.docsUrl} target="_blank" rel="noreferrer">
                            docs
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
    </section>
  );
}
