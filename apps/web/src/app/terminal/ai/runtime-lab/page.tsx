import Link from 'next/link';
import { RuntimeLabConsole } from '../../../../components/ai/runtime-lab-console';
import { PackDisabledState } from '../../../../components/feedback/pack-disabled-state';
import { resolveProductPacks } from '../../../../lib/product-packs';

/**
 * Eng-lab diagnostics. Enable: TRADEOPS_ENABLE_ENG_LABS=1
 */
export default function AiRuntimeLabPage() {
  if (!resolveProductPacks().engLabs) {
    return <PackDisabledState pack="engLabs" />;
  }
  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Diagnostics · AI runtime</p>
          <h1 className="workspace-title-active">AI Runtime Lab</h1>
          <p className="lede">
            End-to-end checks against <code>POST /api/v1/ai/chat</code> and{' '}
            <code>GET /api/v1/ai/health</code>. Missing Cohere must show{' '}
            <strong>blocked</strong>, never a demonstration answer. Simulation stays off unless
            explicitly enabled.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href="/terminal/ai">
            AI workspace
          </Link>
          <Link className="btn ghost" href="/terminal/objectives">
            Objectives
          </Link>
        </div>
      </header>
      <RuntimeLabConsole />
    </section>
  );
}
