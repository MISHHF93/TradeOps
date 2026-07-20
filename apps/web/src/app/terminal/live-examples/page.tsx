import Link from 'next/link';
import { LiveExamplesClient } from '../../../components/ai/live-examples-client';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { PackDisabledState } from '../../../components/feedback/pack-disabled-state';
import { resolveProductPacks } from '../../../lib/product-packs';
import { terminalGet } from '../../../lib/terminal-api';

type LiveExamplesResponse = {
  examples: Array<{
    id: string;
    name: string;
    description: string;
    objective: string;
    targetMarket?: string;
    requiredCapabilities: string[];
    optionalCapabilities: string[];
    riskClass: string;
    expectedStages: string[];
    completionCriteria: string[];
    objectiveTypeHint: string;
    runnable: boolean;
    readiness: string;
    reason: string;
    liveConnectorCount: number;
    fixtureConnectorCount: number;
    capabilities: Array<{
      capability: string;
      available: boolean;
      dataClass: string;
      providerKeys: string[];
    }>;
  }>;
  productCount: number;
  connectors: Array<{
    providerKey: string;
    status: string;
    dataClass: string;
    label: string;
  }>;
  honesty?: { note?: string };
};

export default async function LiveExamplesPage() {
  if (!resolveProductPacks().engLabs) {
    return <PackDisabledState pack="engLabs" />;
  }
  const result = await terminalGet<LiveExamplesResponse>('/api/v1/ai/live-examples');

  return (
    <TerminalPageFrame
      pill="AI · live examples"
      title="Live examples"
      lede="Preconfigured objectives that run through real OperatorRun services — not static mockups. Fixture sources are labeled explicitly."
      relatedPrimary="ai"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { href: '/terminal/objectives', label: 'AI' },
        { label: 'Live examples' },
      ]}
      toolbar={
        <>
          <Link className="btn primary" href="/terminal/objectives">
            AI workspace
          </Link>
          <Link className="btn ghost" href="/terminal/objectives">
            Run history
          </Link>
        </>
      }
      error={result.ok ? null : result.error}
    >

      {result.ok ? (
        <>
          <div className="detail-grid" style={{ marginBottom: 16 }}>
            <article className="panel">
              <h2>Environment honesty</h2>
              <ul className="kv">
                <li>
                  <span>Products in store</span>
                  <strong>{result.data.productCount}</strong>
                </li>
                <li>
                  <span>Connectors</span>
                  <strong>{result.data.connectors.length}</strong>
                </li>
              </ul>
              <p className="meta">{result.data.honesty?.note}</p>
            </article>
            <article className="panel">
              <h2>Connectors</h2>
              <ul className="meta">
                {result.data.connectors.map((c) => (
                  <li key={c.providerKey}>
                    <strong>{c.providerKey}</strong> · {c.status} ·{' '}
                    <span
                      className={
                        c.dataClass === 'TEST_FIXTURE' ? 'text-warning' : 'text-accent'
                      }
                    >
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <LiveExamplesClient examples={result.data.examples} />
        </>
      ) : null}
    </TerminalPageFrame>
  );
}
