import Link from 'next/link';
import { packDisabledMessage, type ProductPacks } from '../../lib/product-packs';

/**
 * Shown when a gated product pack route is hit while the pack is disabled.
 */
export function PackDisabledState({ pack }: { pack: keyof ProductPacks }) {
  return (
    <section className="terminal-page" style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}>
      <p className="pill">Pack disabled</p>
      <h1 className="workspace-title-active">Not enabled in this workspace</h1>
      <p className="lede">{packDisabledMessage(pack)}</p>
      <div className="cta-row">
        <Link className="btn primary" href="/terminal/workspace">
          Home
        </Link>
        <Link className="btn ghost" href="/terminal/process">
          Cases
        </Link>
        <Link className="btn ghost" href="/terminal/connectors">
          Connections
        </Link>
      </div>
    </section>
  );
}
