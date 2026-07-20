/**
 * Product surface packs — default OFF so the core Commerce OS stays simple.
 * Enable with env (server) or NEXT_PUBLIC_ (client) flags.
 *
 * TRADEOPS_ENABLE_CAPITAL=1
 * TRADEOPS_ENABLE_NETWORK=1
 * TRADEOPS_ENABLE_INDUSTRIAL=1
 * TRADEOPS_ENABLE_ENG_LABS=1
 */

function truthy(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export type ProductPacks = {
  capital: boolean;
  network: boolean;
  industrial: boolean;
  engLabs: boolean;
};

/** Server-side pack resolution (reads process.env). */
export function resolveProductPacks(): ProductPacks {
  return {
    capital:
      truthy(process.env.TRADEOPS_ENABLE_CAPITAL) ||
      truthy(process.env.NEXT_PUBLIC_TRADEOPS_ENABLE_CAPITAL),
    network:
      truthy(process.env.TRADEOPS_ENABLE_NETWORK) ||
      truthy(process.env.NEXT_PUBLIC_TRADEOPS_ENABLE_NETWORK),
    industrial:
      truthy(process.env.TRADEOPS_ENABLE_INDUSTRIAL) ||
      truthy(process.env.NEXT_PUBLIC_TRADEOPS_ENABLE_INDUSTRIAL),
    engLabs:
      truthy(process.env.TRADEOPS_ENABLE_ENG_LABS) ||
      truthy(process.env.NEXT_PUBLIC_TRADEOPS_ENABLE_ENG_LABS),
  };
}

export function packDisabledMessage(pack: keyof ProductPacks): string {
  const names: Record<keyof ProductPacks, string> = {
    capital: 'Commerce Capital',
    network: 'Commerce Network',
    industrial: 'Industrial Commerce OS',
    engLabs: 'Engineering labs (runtime lab, live examples, AI platform workspace)',
  };
  const env: Record<keyof ProductPacks, string> = {
    capital: 'TRADEOPS_ENABLE_CAPITAL=1',
    network: 'TRADEOPS_ENABLE_NETWORK=1',
    industrial: 'TRADEOPS_ENABLE_INDUSTRIAL=1',
    engLabs: 'TRADEOPS_ENABLE_ENG_LABS=1',
  };
  return `${names[pack]} is disabled in this workspace. Enable with ${env[pack]} and restart the app.`;
}
