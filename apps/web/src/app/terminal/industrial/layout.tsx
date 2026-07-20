import type { ReactNode } from 'react';
import { PackDisabledState } from '../../../components/feedback/pack-disabled-state';
import { resolveProductPacks } from '../../../lib/product-packs';

/**
 * Industrial pack — off by default.
 * Enable: TRADEOPS_ENABLE_INDUSTRIAL=1
 */
export default function IndustrialLayout({ children }: { children: ReactNode }) {
  const packs = resolveProductPacks();
  if (!packs.industrial) {
    return <PackDisabledState pack="industrial" />;
  }
  return children;
}
