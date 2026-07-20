import type { ReactNode } from 'react';
import { PackDisabledState } from '../../components/feedback/pack-disabled-state';
import { resolveProductPacks } from '../../lib/product-packs';

/**
 * Network pack — off by default.
 * Enable: TRADEOPS_ENABLE_NETWORK=1
 */
export default function NetworkLayout({ children }: { children: ReactNode }) {
  const packs = resolveProductPacks();
  if (!packs.network) {
    return <PackDisabledState pack="network" />;
  }
  return children;
}
