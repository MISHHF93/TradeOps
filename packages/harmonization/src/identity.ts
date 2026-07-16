/**
 * Identity-resolution engine — confidence-scored matches only.
 * Never merge products solely because titles look similar.
 */

export type IdentifierScheme =
  | 'gtin'
  | 'upc'
  | 'ean'
  | 'isbn'
  | 'mpn'
  | 'sku'
  | 'asin'
  | 'offer_id'
  | 'external_id';

export type ProductIdentityInput = {
  productId: string;
  title: string;
  brand?: string | null;
  sourcePlatform: string;
  externalId: string;
  identifiers?: Array<{ scheme: IdentifierScheme | string; value: string; confidence?: number }>;
  category?: string;
};

export type IdentityMatch = {
  sourceProductId: string;
  targetProductId: string;
  matchMethod: string;
  confidence: number;
  evidence: Record<string, unknown>;
  /** Only auto-link when confidence >= this threshold (default 0.92) */
  autoLinkEligible: boolean;
};

const AUTO_LINK_THRESHOLD = 0.92;
const TITLE_ONLY_CAP = 0.55;

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, '');
}

function tokenizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score pair of products. Strong identifier matches dominate title similarity.
 */
export function scoreIdentityPair(
  a: ProductIdentityInput,
  b: ProductIdentityInput,
): IdentityMatch | null {
  if (a.productId === b.productId) return null;

  const evidence: Record<string, unknown> = {
    sourcePlatformA: a.sourcePlatform,
    sourcePlatformB: b.sourcePlatform,
  };
  let confidence = 0;
  let matchMethod = 'none';

  const idsA = a.identifiers ?? [];
  const idsB = b.identifiers ?? [];

  for (const ia of idsA) {
    for (const ib of idsB) {
      if (ia.scheme !== ib.scheme) continue;
      if (normalizeId(ia.value) === normalizeId(ib.value) && ia.value.trim().length >= 4) {
        const schemeBoost =
          ia.scheme === 'gtin' || ia.scheme === 'upc' || ia.scheme === 'ean' || ia.scheme === 'isbn'
            ? 0.98
            : ia.scheme === 'mpn'
              ? 0.93
              : 0.88;
        if (schemeBoost > confidence) {
          confidence = schemeBoost;
          matchMethod = `identifier:${ia.scheme}`;
          evidence.matchedValue = ia.value;
          evidence.scheme = ia.scheme;
        }
      }
    }
  }

  // Same external id across platforms is weak without scheme
  if (normalizeId(a.externalId) === normalizeId(b.externalId) && a.externalId.length >= 6) {
    if (0.75 > confidence) {
      confidence = 0.75;
      matchMethod = 'external_id';
      evidence.externalId = a.externalId;
    }
  }

  const titleSim = jaccard(tokenizeTitle(a.title), tokenizeTitle(b.title));
  evidence.titleSimilarity = Math.round(titleSim * 1000) / 1000;

  if (titleSim >= 0.7) {
    let titleConf = Math.min(TITLE_ONLY_CAP, 0.35 + titleSim * 0.3);
    if (
      a.brand &&
      b.brand &&
      a.brand.trim().toLowerCase() === b.brand.trim().toLowerCase()
    ) {
      titleConf = Math.min(0.72, titleConf + 0.15);
      evidence.brandMatch = true;
    }
    if (titleConf > confidence) {
      confidence = titleConf;
      matchMethod = 'title_similarity';
    }
  }

  if (confidence < 0.4) return null;

  return {
    sourceProductId: a.productId,
    targetProductId: b.productId,
    matchMethod,
    confidence: Math.round(confidence * 1000) / 1000,
    evidence,
    autoLinkEligible: confidence >= AUTO_LINK_THRESHOLD && matchMethod.startsWith('identifier:'),
  };
}

/**
 * All-pairs matching for a small catalog (N typically small in local org).
 */
export function resolveIdentities(products: ProductIdentityInput[]): IdentityMatch[] {
  const matches: IdentityMatch[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const m = scoreIdentityPair(products[i]!, products[j]!);
      if (m) matches.push(m);
    }
  }
  return matches.sort((a, b) => b.confidence - a.confidence);
}

export const IDENTITY_AUTO_LINK_THRESHOLD = AUTO_LINK_THRESHOLD;
