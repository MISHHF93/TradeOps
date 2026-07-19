/**
 * Knowledge graph projection — explicit relationships for AI reasoning.
 * Not a separate graph database: a typed edge layer over canonical models.
 */

import type { BusinessObjectType } from './business-objects';

export type GraphRelation =
  | 'case_for_product'
  | 'product_from_supplier'
  | 'product_has_offer'
  | 'product_has_listing'
  | 'product_has_opportunity'
  | 'product_has_signal'
  | 'product_has_artifact'
  | 'listing_on_channel'
  | 'order_contains_product'
  | 'order_has_payment'
  | 'order_has_shipment'
  | 'order_has_po'
  | 'approval_for_listing'
  | 'approval_for_po'
  | 'ai_run_about_product'
  | 'ai_run_about_case'
  | 'connector_supplies'
  | 'connector_sells'
  | 'workflow_touches_case'
  | 'case_advances_to';

export type KnowledgeGraphNode = {
  type: BusinessObjectType;
  id: string;
  label: string;
  href?: string;
  meta?: Record<string, unknown>;
};

export type KnowledgeGraphEdge = {
  relation: GraphRelation;
  from: { type: BusinessObjectType; id: string };
  to: { type: BusinessObjectType; id: string };
  weight?: number;
  at?: string;
  meta?: Record<string, unknown>;
};

export type KnowledgeGraphProjection = {
  root: KnowledgeGraphNode;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  computedAt: string;
  honesty: {
    note: string;
  };
};

export type CaseGraphInput = {
  caseId: string;
  caseLabel: string;
  productId: string;
  productTitle: string;
  productSourcePlatform?: string | null;
  supplierIds?: Array<{ id: string; name: string }>;
  listingIds?: Array<{ id: string; status: string }>;
  opportunityIds?: string[];
  orderIds?: Array<{ id: string; status: string }>;
  paymentIds?: string[];
  shipmentIds?: string[];
  artifactIds?: Array<{ id: string; kind: string }>;
  approvalIds?: string[];
  connectorKeys?: Array<{ key: string; isFixture?: boolean }>;
  aiRunIds?: string[];
  signalIds?: string[];
};

/**
 * Build a case-centric knowledge graph projection for UI + AI.
 */
export function projectCaseKnowledgeGraph(input: CaseGraphInput): KnowledgeGraphProjection {
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (n: KnowledgeGraphNode) => {
    const k = `${n.type}:${n.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    nodes.push(n);
  };

  const root: KnowledgeGraphNode = {
    type: 'commerce_case',
    id: input.caseId,
    label: input.caseLabel,
    href: `/terminal/process/${input.caseId}`,
  };
  addNode(root);

  addNode({
    type: 'product',
    id: input.productId,
    label: input.productTitle,
    href: `/terminal/products/${input.productId}`,
    meta: { sourcePlatform: input.productSourcePlatform ?? null },
  });
  edges.push({
    relation: 'case_for_product',
    from: { type: 'commerce_case', id: input.caseId },
    to: { type: 'product', id: input.productId },
  });

  for (const s of input.supplierIds ?? []) {
    addNode({ type: 'supplier', id: s.id, label: s.name });
    edges.push({
      relation: 'product_from_supplier',
      from: { type: 'product', id: input.productId },
      to: { type: 'supplier', id: s.id },
    });
  }

  for (const l of input.listingIds ?? []) {
    addNode({
      type: 'listing',
      id: l.id,
      label: `Listing (${l.status})`,
      href: '/terminal/listings',
      meta: { status: l.status },
    });
    edges.push({
      relation: 'product_has_listing',
      from: { type: 'product', id: input.productId },
      to: { type: 'listing', id: l.id },
    });
  }

  for (const oid of input.opportunityIds ?? []) {
    addNode({
      type: 'opportunity',
      id: oid,
      label: 'Opportunity',
      href: '/terminal/opportunities',
    });
    edges.push({
      relation: 'product_has_opportunity',
      from: { type: 'product', id: input.productId },
      to: { type: 'opportunity', id: oid },
    });
  }

  for (const o of input.orderIds ?? []) {
    addNode({
      type: 'order',
      id: o.id,
      label: `Order (${o.status})`,
      href: '/terminal/orders',
      meta: { status: o.status },
    });
    edges.push({
      relation: 'order_contains_product',
      from: { type: 'order', id: o.id },
      to: { type: 'product', id: input.productId },
    });
  }

  for (const pid of input.paymentIds ?? []) {
    addNode({ type: 'payment', id: pid, label: 'Payment', href: '/terminal/finance/payments' });
  }

  for (const sid of input.shipmentIds ?? []) {
    addNode({ type: 'shipment', id: sid, label: 'Shipment', href: '/terminal/fulfillment' });
  }

  for (const a of input.artifactIds ?? []) {
    addNode({
      type: 'ai_artifact',
      id: a.id,
      label: a.kind,
      meta: { kind: a.kind },
    });
    edges.push({
      relation: 'product_has_artifact',
      from: { type: 'product', id: input.productId },
      to: { type: 'ai_artifact', id: a.id },
    });
  }

  for (const aid of input.approvalIds ?? []) {
    addNode({ type: 'approval', id: aid, label: 'Approval', href: '/terminal/approvals' });
  }

  for (const c of input.connectorKeys ?? []) {
    addNode({
      type: 'connector',
      id: c.key,
      label: c.key,
      href: '/terminal/connectors',
      meta: { isFixture: Boolean(c.isFixture) },
    });
    edges.push({
      relation: c.isFixture ? 'connector_supplies' : 'connector_sells',
      from: { type: 'connector', id: c.key },
      to: { type: 'product', id: input.productId },
    });
  }

  for (const rid of input.aiRunIds ?? []) {
    addNode({
      type: 'ai_run',
      id: rid,
      label: 'AI run',
      href: `/terminal/objectives/${rid}`,
    });
    edges.push({
      relation: 'ai_run_about_case',
      from: { type: 'ai_run', id: rid },
      to: { type: 'commerce_case', id: input.caseId },
    });
  }

  for (const sid of input.signalIds ?? []) {
    addNode({ type: 'signal', id: sid, label: 'Signal', href: '/terminal/signals' });
    edges.push({
      relation: 'product_has_signal',
      from: { type: 'product', id: input.productId },
      to: { type: 'signal', id: sid },
    });
  }

  return {
    root,
    nodes,
    edges,
    computedAt: new Date().toISOString(),
    honesty: {
      note: 'Graph is a projection over canonical TradeOps models — not a separate graph database.',
    },
  };
}
