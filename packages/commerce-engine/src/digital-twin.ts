/**
 * Operational Digital Twin — graph projection over commerce + industrial entities.
 * AI reasons over relationships, not isolated rows.
 */

export type TwinNodeKind =
  | 'product'
  | 'supplier'
  | 'warehouse'
  | 'factory'
  | 'shipment'
  | 'purchase_order'
  | 'inventory_position'
  | 'maintenance_asset'
  | 'customer_order'
  | 'artifact'
  | 'organization';

export type TwinEdgeKind =
  | 'supplied_by'
  | 'stocked_at'
  | 'ships'
  | 'fulfills'
  | 'purchases'
  | 'maintains'
  | 'compatible_with'
  | 'spare_for'
  | 'documents'
  | 'owns';

export type TwinNode = {
  id: string;
  kind: TwinNodeKind;
  label: string;
  refId?: string;
  isFixture?: boolean;
  attributes?: Record<string, string | number | boolean | null>;
};

export type TwinEdge = {
  id: string;
  kind: TwinEdgeKind;
  from: string;
  to: string;
  label?: string;
  weight?: number;
};

export type DigitalTwinSnapshot = {
  organizationId: string;
  generatedAt: string;
  nodes: TwinNode[];
  edges: TwinEdge[];
  summary: {
    nodeCounts: Record<string, number>;
    edgeCounts: Record<string, number>;
    fixtureNodes: number;
  };
  honesty: { note: string };
};

export type TwinBuildInput = {
  organizationId: string;
  products?: Array<{
    id: string;
    title: string;
    sourcePlatform?: string;
    inventoryQuantity?: number;
    manufacturer?: string | null;
  }>;
  suppliers?: Array<{ id: string; name: string; sourcePlatform?: string }>;
  offers?: Array<{ productId: string; supplierId: string }>;
  warehouses?: Array<{ id: string; name: string }>;
  purchaseOrders?: Array<{
    id: string;
    productId: string;
    status: string;
    supplierName?: string;
  }>;
  orders?: Array<{ id: string; status: string; externalId?: string }>;
  artifacts?: Array<{ id: string; productId: string; title?: string | null }>;
  maintenanceAssets?: Array<{ id: string; label: string; productId?: string }>;
};

/**
 * Build a digital twin graph from org canonical records.
 */
export function buildDigitalTwin(input: TwinBuildInput, now = new Date()): DigitalTwinSnapshot {
  const nodes: TwinNode[] = [];
  const edges: TwinEdge[] = [];
  const pushNode = (n: TwinNode) => {
    if (!nodes.some((x) => x.id === n.id)) nodes.push(n);
  };
  const pushEdge = (e: TwinEdge) => {
    edges.push(e);
  };

  pushNode({
    id: `org:${input.organizationId}`,
    kind: 'organization',
    label: 'Organization',
    refId: input.organizationId,
  });

  for (const p of input.products ?? []) {
    const fixture = p.sourcePlatform?.startsWith('fixture');
    pushNode({
      id: `product:${p.id}`,
      kind: 'product',
      label: p.title,
      refId: p.id,
      isFixture: fixture,
      attributes: {
        inventory: p.inventoryQuantity ?? null,
        manufacturer: p.manufacturer ?? null,
      },
    });
    pushEdge({
      id: `owns-p-${p.id}`,
      kind: 'owns',
      from: `org:${input.organizationId}`,
      to: `product:${p.id}`,
    });
    if (p.inventoryQuantity != null) {
      const invId = `inv:${p.id}`;
      pushNode({
        id: invId,
        kind: 'inventory_position',
        label: `Inventory ${p.title}`,
        attributes: { qty: p.inventoryQuantity },
        isFixture: fixture,
      });
      pushEdge({
        id: `stock-${p.id}`,
        kind: 'stocked_at',
        from: `product:${p.id}`,
        to: invId,
      });
    }
  }

  for (const s of input.suppliers ?? []) {
    pushNode({
      id: `supplier:${s.id}`,
      kind: 'supplier',
      label: s.name,
      refId: s.id,
      isFixture: s.sourcePlatform?.startsWith('fixture'),
    });
  }

  for (const o of input.offers ?? []) {
    pushEdge({
      id: `offer-${o.productId}-${o.supplierId}`,
      kind: 'supplied_by',
      from: `product:${o.productId}`,
      to: `supplier:${o.supplierId}`,
    });
  }

  for (const w of input.warehouses ?? []) {
    pushNode({
      id: `warehouse:${w.id}`,
      kind: 'warehouse',
      label: w.name,
      refId: w.id,
    });
  }

  for (const po of input.purchaseOrders ?? []) {
    pushNode({
      id: `po:${po.id}`,
      kind: 'purchase_order',
      label: `PO ${po.id.slice(0, 8)} (${po.status})`,
      refId: po.id,
      attributes: { status: po.status },
    });
    pushEdge({
      id: `po-buys-${po.id}`,
      kind: 'purchases',
      from: `po:${po.id}`,
      to: `product:${po.productId}`,
    });
  }

  for (const ord of input.orders ?? []) {
    pushNode({
      id: `order:${ord.id}`,
      kind: 'customer_order',
      label: ord.externalId ?? `Order ${ord.id.slice(0, 8)}`,
      refId: ord.id,
      attributes: { status: ord.status },
    });
  }

  for (const a of input.artifacts ?? []) {
    pushNode({
      id: `artifact:${a.id}`,
      kind: 'artifact',
      label: a.title ?? 'Artifact',
      refId: a.id,
    });
    pushEdge({
      id: `doc-${a.id}`,
      kind: 'documents',
      from: `artifact:${a.id}`,
      to: `product:${a.productId}`,
    });
  }

  for (const m of input.maintenanceAssets ?? []) {
    pushNode({
      id: `asset:${m.id}`,
      kind: 'maintenance_asset',
      label: m.label,
      refId: m.id,
    });
    if (m.productId) {
      pushEdge({
        id: `maint-${m.id}`,
        kind: 'maintains',
        from: `asset:${m.id}`,
        to: `product:${m.productId}`,
      });
    }
  }

  const nodeCounts: Record<string, number> = {};
  const edgeCounts: Record<string, number> = {};
  let fixtureNodes = 0;
  for (const n of nodes) {
    nodeCounts[n.kind] = (nodeCounts[n.kind] ?? 0) + 1;
    if (n.isFixture) fixtureNodes += 1;
  }
  for (const e of edges) {
    edgeCounts[e.kind] = (edgeCounts[e.kind] ?? 0) + 1;
  }

  return {
    organizationId: input.organizationId,
    generatedAt: now.toISOString(),
    nodes,
    edges,
    summary: { nodeCounts, edgeCounts, fixtureNodes },
    honesty: {
      note: 'Digital twin is a projection of canonical records. Fixture nodes labeled. Not a live IoT feed unless connectors provide it.',
    },
  };
}

/** Neighborhood query for AI reasoning. */
export function twinNeighborhood(
  snapshot: DigitalTwinSnapshot,
  nodeId: string,
  depth = 1,
): { nodes: TwinNode[]; edges: TwinEdge[] } {
  const edgeSet = new Set<string>();
  const nodeSet = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const e of snapshot.edges) {
      if (nodeSet.has(e.from) || nodeSet.has(e.to)) {
        edgeSet.add(e.id);
        if (!nodeSet.has(e.from)) {
          nodeSet.add(e.from);
          next.push(e.from);
        }
        if (!nodeSet.has(e.to)) {
          nodeSet.add(e.to);
          next.push(e.to);
        }
      }
    }
    frontier = next;
  }
  return {
    nodes: snapshot.nodes.filter((n) => nodeSet.has(n.id)),
    edges: snapshot.edges.filter((e) => edgeSet.has(e.id)),
  };
}
