/**
 * Industrial / enterprise role surfaces — map into core OperatingPersona
 * without forking the commerce OS codebase.
 */

import type { OperatingPersona, StoredWorkspacePersona } from './workspace';

export const INDUSTRIAL_ROLE_SURFACES = [
  'procurement',
  'supply_chain',
  'manufacturing',
  'engineering',
  'maintenance',
  'warehouse',
  'logistics',
  'executive',
  'finance',
  'sales',
] as const;

export type IndustrialRoleSurface = (typeof INDUSTRIAL_ROLE_SURFACES)[number];

export type IndustrialRoleDefinition = {
  id: IndustrialRoleSurface;
  label: string;
  mission: string;
  /** Maps to primary Commerce OS persona for nav/AI */
  mapsToPersona: OperatingPersona;
  homeHref: string;
  defaultObjective: string;
  focusHrefs: Array<{ href: string; label: string }>;
  kpis: string[];
};

export const INDUSTRIAL_ROLE_CATALOG: Record<
  IndustrialRoleSurface,
  IndustrialRoleDefinition
> = {
  procurement: {
    id: 'procurement',
    label: 'Procurement',
    mission: 'Source parts, run RFQs, award suppliers, control MOQ and lead time.',
    mapsToPersona: 'operator',
    homeHref: '/terminal/industrial/procurement',
    defaultObjective:
      'Evaluate open industrial requirements, compare supplier quotes, and recommend award or re-bid with landed cost.',
    focusHrefs: [
      { href: '/terminal/industrial/procurement', label: 'Procurement hub' },
      { href: '/terminal/industrial/products', label: 'Industrial catalog' },
      { href: '/terminal/approvals', label: 'Approvals' },
    ],
    kpis: ['open_rfqs', 'quote_coverage', 'avg_lead_time', 'single_source_risk'],
  },
  supply_chain: {
    id: 'supply_chain',
    label: 'Supply Chain',
    mission: 'Balance inventory, lead times, multi-echelon risk.',
    mapsToPersona: 'analyst',
    homeHref: '/terminal/industrial/twin',
    defaultObjective:
      'Summarize inventory positions, supplier concentration, and shipment risks across the digital twin.',
    focusHrefs: [
      { href: '/terminal/industrial/twin', label: 'Digital twin' },
      { href: '/terminal/portfolio', label: 'Portfolio' },
    ],
    kpis: ['inventory_turns', 'supplier_concentration', 'late_pos'],
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing',
    mission: 'BOM readiness, spare coverage, production material risk.',
    mapsToPersona: 'operator',
    homeHref: '/terminal/industrial/products',
    defaultObjective:
      'Identify BOM gaps, substitute parts, and material shortages affecting production.',
    focusHrefs: [
      { href: '/terminal/industrial/products', label: 'Parts catalog' },
      { href: '/terminal/process', label: 'Process board' },
    ],
    kpis: ['bom_completeness', 'shortage_count'],
  },
  engineering: {
    id: 'engineering',
    label: 'Engineering',
    mission: 'Specs, CAD/docs, compatibility, change impact.',
    mapsToPersona: 'researcher',
    homeHref: '/terminal/industrial/products',
    defaultObjective:
      'Compare technical specifications and locate compatible or substitute industrial parts.',
    focusHrefs: [
      { href: '/terminal/industrial/products', label: 'Technical catalog' },
      { href: '/terminal/ai', label: 'AI technical assistant' },
    ],
    kpis: ['spec_completeness', 'doc_coverage'],
  },
  maintenance: {
    id: 'maintenance',
    label: 'Maintenance',
    mission: 'MRO spares, asset fitment, downtime risk.',
    mapsToPersona: 'operator',
    homeHref: '/terminal/industrial/twin',
    defaultObjective:
      'Recommend spare parts and substitutes for maintenance assets with availability and lead time.',
    focusHrefs: [
      { href: '/terminal/industrial/twin', label: 'Assets & twin' },
      { href: '/terminal/industrial/procurement', label: 'MRO procurement' },
    ],
    kpis: ['spare_coverage', 'critical_asset_risk'],
  },
  warehouse: {
    id: 'warehouse',
    label: 'Warehouse Operations',
    mission: 'Receive, putaway, pick accuracy, industrial packaging.',
    mapsToPersona: 'operator',
    homeHref: '/terminal/fulfillment',
    defaultObjective:
      'Prioritize inbound POs and inventory positions for warehouse execution.',
    focusHrefs: [
      { href: '/terminal/fulfillment', label: 'Fulfillment' },
      { href: '/terminal/orders', label: 'Orders' },
    ],
    kpis: ['open_receipts', 'inventory_accuracy'],
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics',
    mission: 'Landed cost, hazmat, carrier and lead-time orchestration.',
    mapsToPersona: 'operator',
    homeHref: '/terminal/industrial/procurement',
    defaultObjective:
      'Assess logistics and hazmat risk on preferred suppliers and recommend routing options.',
    focusHrefs: [
      { href: '/terminal/connectors', label: 'Logistics connectors' },
      { href: '/terminal/industrial/procurement', label: 'Landed cost' },
    ],
    kpis: ['in_transit', 'hazmat_shipments'],
  },
  executive: {
    id: 'executive',
    label: 'Executive Leadership',
    mission: 'Industrial portfolio health, risk, cash, approvals.',
    mapsToPersona: 'executive',
    homeHref: '/terminal/workspace/executive',
    defaultObjective:
      'Executive brief: industrial procurement risk, single-source exposure, and cash committed to POs.',
    focusHrefs: [
      { href: '/terminal/workspace/executive', label: 'Executive home' },
      { href: '/terminal/industrial', label: 'Industrial OS' },
    ],
    kpis: ['po_spend', 'risk_score', 'approvals_pending'],
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    mission: 'Landed cost, payables, working capital on industrial buys.',
    mapsToPersona: 'analyst',
    homeHref: '/terminal/cashflow',
    defaultObjective:
      'Explain industrial purchasing cash exposure and contribution economics on awards.',
    focusHrefs: [
      { href: '/terminal/cashflow', label: 'Cash' },
      { href: '/terminal/finance/payments', label: 'Payments' },
    ],
    kpis: ['committed_cash', 'landed_cost_variance'],
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    mission: 'B2B quotes, availability promises, industrial catalog readiness.',
    mapsToPersona: 'researcher',
    homeHref: '/terminal/industrial/products',
    defaultObjective:
      'Prepare industrial catalog responses with availability, lead time, and substitute options.',
    focusHrefs: [
      { href: '/terminal/industrial/products', label: 'Catalog' },
      { href: '/terminal/customers', label: 'Customers' },
    ],
    kpis: ['quote_sla', 'fill_rate'],
  },
};

/** Map stored membership persona → industrial role surface when applicable. */
export function industrialRoleFromStored(
  stored: StoredWorkspacePersona | string,
): IndustrialRoleSurface | null {
  const s = String(stored).toLowerCase();
  if (s === 'procurement') return 'procurement';
  if (s === 'finance') return 'finance';
  if (s === 'executive' || s === 'founder') return 'executive';
  if (s === 'operator') return 'warehouse';
  if (s === 'analyst') return 'supply_chain';
  if (s === 'researcher') return 'engineering';
  return null;
}

export function listIndustrialRoles() {
  return INDUSTRIAL_ROLE_SURFACES.map((id) => INDUSTRIAL_ROLE_CATALOG[id]);
}
