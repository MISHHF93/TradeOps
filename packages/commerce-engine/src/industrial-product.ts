/**
 * Canonical Industrial Product profile — generalizes retail Product.
 * Stored primarily in Product.attributesJson.industrial (no separate codebase).
 */

import type { IndustrialVertical } from './industrial-domains';

export type PartRelationKind =
  | 'replaces'
  | 'replaced_by'
  | 'compatible_with'
  | 'spare_for'
  | 'assembly_of'
  | 'accessory_for'
  | 'supersedes'
  | 'cross_reference';

export type IndustrialPartRelation = {
  kind: PartRelationKind;
  relatedSku?: string;
  relatedOem?: string;
  relatedMpn?: string;
  relatedProductId?: string;
  note?: string;
  confidence?: number;
};

export type IndustrialTechnicalSpec = {
  key: string;
  value: string;
  unit?: string;
  standard?: string;
};

export type IndustrialDimensions = {
  length?: number;
  width?: number;
  height?: number;
  unit?: 'mm' | 'cm' | 'in' | 'm';
  weight?: number;
  weightUnit?: 'g' | 'kg' | 'lb' | 'oz';
};

export type IndustrialDocumentRef = {
  kind:
    | 'sds'
    | 'cad'
    | 'manual'
    | 'install_guide'
    | 'warranty'
    | 'certificate'
    | 'drawing'
    | 'other';
  title: string;
  artifactId?: string;
  url?: string;
  language?: string;
};

/** Canonical industrial fields — maps onto / extends retail Product. */
export type IndustrialProductProfile = {
  schemaVersion: 'industrial-v1';
  commerceMode: 'retail' | 'industrial' | 'hybrid';
  verticals: IndustrialVertical[];
  manufacturer?: string;
  brand?: string;
  oemPartNumber?: string;
  manufacturerPartNumber?: string;
  sku?: string;
  gtin?: string;
  upc?: string;
  ean?: string;
  technicalSpecifications: IndustrialTechnicalSpec[];
  dimensions?: IndustrialDimensions;
  materials?: string[];
  certifications?: string[];
  documents: IndustrialDocumentRef[];
  compatibleEquipment?: string[];
  relations: IndustrialPartRelation[];
  warrantyMonths?: number;
  warrantyText?: string;
  countryOfOrigin?: string;
  leadTimeDays?: number;
  moq?: number;
  packaging?: string;
  hazmatClass?: string;
  hazmatUnNumber?: string;
  inventoryQuantity?: number;
  listPriceMinor?: number;
  costMinor?: number;
  currency?: string;
  supplierAvailability?: Array<{
    supplierName: string;
    availableQty?: number;
    leadTimeDays?: number;
    unitCostMinor?: number;
  }>;
  /** Free-form industrial attributes */
  extras?: Record<string, string | number | boolean | null>;
};

export function emptyIndustrialProfile(
  partial?: Partial<IndustrialProductProfile>,
): IndustrialProductProfile {
  return {
    schemaVersion: 'industrial-v1',
    commerceMode: partial?.commerceMode ?? 'hybrid',
    verticals: partial?.verticals ?? [],
    technicalSpecifications: partial?.technicalSpecifications ?? [],
    documents: partial?.documents ?? [],
    relations: partial?.relations ?? [],
    materials: partial?.materials ?? [],
    certifications: partial?.certifications ?? [],
    ...partial,
  };
}

/**
 * Extract industrial profile from a Product-like row (attributesJson.industrial + columns).
 */
export function industrialProfileFromProduct(product: {
  title?: string;
  brand?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  inventoryQuantity?: number;
  supplierCostMinor?: number;
  targetPriceMinor?: number;
  currency?: string;
  externalId?: string;
  attributesJson?: unknown;
}): IndustrialProductProfile {
  const attrs =
    product.attributesJson && typeof product.attributesJson === 'object'
      ? (product.attributesJson as Record<string, unknown>)
      : {};
  const raw = (attrs.industrial ?? attrs.Industrial ?? {}) as Partial<IndustrialProductProfile>;
  const base = emptyIndustrialProfile({
    ...raw,
    manufacturer: raw.manufacturer ?? product.manufacturer ?? undefined,
    brand: raw.brand ?? product.brand ?? undefined,
    countryOfOrigin: raw.countryOfOrigin ?? product.countryOfOrigin ?? undefined,
    inventoryQuantity: raw.inventoryQuantity ?? product.inventoryQuantity,
    costMinor: raw.costMinor ?? product.supplierCostMinor,
    listPriceMinor: raw.listPriceMinor ?? product.targetPriceMinor,
    currency: raw.currency ?? product.currency,
    sku: raw.sku ?? product.externalId,
  });
  return base;
}

/** Completeness score for industrial digital twin readiness (0–100). */
export function scoreIndustrialCompleteness(p: IndustrialProductProfile): {
  score: number;
  missing: string[];
  factors: Array<{ key: string; ok: boolean }>;
} {
  const checks: Array<{ key: string; ok: boolean; weight: number }> = [
    { key: 'manufacturer', ok: Boolean(p.manufacturer || p.brand), weight: 10 },
    { key: 'part_number', ok: Boolean(p.oemPartNumber || p.manufacturerPartNumber || p.sku), weight: 15 },
    { key: 'identity', ok: Boolean(p.gtin || p.upc || p.ean || p.sku), weight: 10 },
    { key: 'specs', ok: (p.technicalSpecifications?.length ?? 0) > 0, weight: 15 },
    { key: 'docs', ok: (p.documents?.length ?? 0) > 0, weight: 10 },
    { key: 'lead_time', ok: p.leadTimeDays != null, weight: 8 },
    { key: 'moq', ok: p.moq != null, weight: 5 },
    { key: 'origin', ok: Boolean(p.countryOfOrigin), weight: 5 },
    { key: 'inventory', ok: p.inventoryQuantity != null, weight: 7 },
    { key: 'pricing', ok: p.listPriceMinor != null || p.costMinor != null, weight: 10 },
    { key: 'relations', ok: (p.relations?.length ?? 0) > 0, weight: 5 },
  ];
  const totalW = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  return {
    score: Math.round((earned / totalW) * 100),
    missing,
    factors: checks.map((c) => ({ key: c.key, ok: c.ok })),
  };
}

/** Simple substitute ranking by shared specs / part number family. */
export function rankSubstituteParts(
  target: IndustrialProductProfile,
  candidates: Array<{ productId: string; title: string; profile: IndustrialProductProfile }>,
): Array<{ productId: string; title: string; score: number; reasons: string[] }> {
  const targetKeys = new Set(
    (target.technicalSpecifications ?? []).map((s) => `${s.key}:${s.value}`.toLowerCase()),
  );
  const targetMpn = (target.manufacturerPartNumber ?? target.oemPartNumber ?? '').toLowerCase();

  return candidates
    .map((c) => {
      const reasons: string[] = [];
      let score = 0;
      const cMpn = (c.profile.manufacturerPartNumber ?? c.profile.oemPartNumber ?? '').toLowerCase();
      if (targetMpn && cMpn && (cMpn.includes(targetMpn.slice(0, 6)) || targetMpn.includes(cMpn.slice(0, 6)))) {
        score += 40;
        reasons.push('part_number_family');
      }
      if (target.manufacturer && c.profile.manufacturer === target.manufacturer) {
        score += 15;
        reasons.push('same_manufacturer');
      }
      let shared = 0;
      for (const s of c.profile.technicalSpecifications ?? []) {
        if (targetKeys.has(`${s.key}:${s.value}`.toLowerCase())) shared += 1;
      }
      if (shared > 0) {
        score += Math.min(35, shared * 7);
        reasons.push(`shared_specs=${shared}`);
      }
      for (const r of c.profile.relations ?? []) {
        if (
          r.kind === 'replaces' ||
          r.kind === 'compatible_with' ||
          r.kind === 'cross_reference'
        ) {
          score += 10;
          reasons.push(`relation_${r.kind}`);
        }
      }
      return { productId: c.productId, title: c.title, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
