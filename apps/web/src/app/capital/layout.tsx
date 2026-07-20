import type { ReactNode } from 'react';
import { PackDisabledState } from '../../components/feedback/pack-disabled-state';
import { resolveProductPacks } from '../../lib/product-packs';

/**
 * Capital pack — off by default (AI-first Commerce OS isolation).
 * Enable: TRADEOPS_ENABLE_CAPITAL=1
 */
export default function CapitalLayout({ children }: { children: ReactNode }) {
  const packs = resolveProductPacks();
  if (!packs.capital) {
    return <PackDisabledState pack="capital" />;
  }
  return children;
}
