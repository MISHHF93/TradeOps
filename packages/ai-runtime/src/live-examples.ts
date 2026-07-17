/**
 * Live Example Framework — preconfigured objectives that run through
 * real TradeOps services (OperatorRun + tools + connectors), not mock pages.
 */

export type LiveExampleRiskClass =
  | 'read_only'
  | 'draft'
  | 'approval_required'
  | 'financial_contractual';

export type LiveExampleReadiness =
  | 'ready'
  | 'partially_ready'
  | 'credentials_required'
  | 'connector_unhealthy'
  | 'not_implemented';

export type LiveExampleDefinition = {
  id: string;
  name: string;
  description: string;
  objective: string;
  targetMarket?: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  riskClass: LiveExampleRiskClass;
  expectedStages: string[];
  completionCriteria: string[];
  /** Maps to operator objective classification */
  objectiveTypeHint:
    | 'READ_ONLY_ANALYSIS'
    | 'DRAFT_LISTING'
    | 'PUBLISH_LISTING'
    | 'SUPPLIER_PO'
    | 'MIXED';
  /** When false, example is defined but not fully wired for automated run */
  runnable: boolean;
};

export const LIVE_EXAMPLES: LiveExampleDefinition[] = [
  {
    id: 'canadian-product-opportunity-scan',
    name: 'Canadian Product Opportunity Scan',
    description:
      'Search connected supplier/marketplace product store for Canada sell opportunities with margin >25%, low policy risk, and evidence-backed ranking.',
    objective:
      'Search my connected supplier and marketplace sources for products that may be worth selling in Canada. Prioritize low landed cost, reasonable shipping time, credible demand, healthy reviews, low policy risk, and expected contribution margin above 25%. Return the strongest opportunities with evidence and recommended next actions.',
    targetMarket: 'CA',
    requiredCapabilities: ['searchProducts', 'readProduct'],
    optionalCapabilities: ['readReviews', 'readMarketplacePrices', 'readSupplierOffers'],
    riskClass: 'read_only',
    expectedStages: [
      'understanding',
      'checking_connectors',
      'collecting',
      'normalizing',
      'evaluating',
      'ranking',
      'completed',
    ],
    completionCriteria: [
      'objective classified READ_ONLY_ANALYSIS',
      'approvalRequired false',
      'timeline persisted on OperatorRun',
      'ranked recommendations with productCard economics',
      'results available at /terminal/opportunities?runId=',
    ],
    objectiveTypeHint: 'READ_ONLY_ANALYSIS',
    runnable: true,
  },
  {
    id: 'supplier-comparison-listing-draft',
    name: 'Supplier Comparison and Listing Draft',
    description:
      'For the strongest evaluated product, compare supplier economics and prepare a listing draft (no external publish).',
    objective:
      'For the strongest evaluated product, compare every available supplier, select the strongest offer, calculate expected profit on each connected sales channel, and prepare a listing draft for the best channel.',
    requiredCapabilities: ['readSupplierOffers', 'readProduct', 'createListing'],
    optionalCapabilities: ['readMarketplacePrices'],
    riskClass: 'draft',
    expectedStages: [
      'understanding',
      'collecting',
      'evaluating',
      'draft',
      'completed',
    ],
    completionCriteria: [
      'listing created with status draft',
      'no publish_listing approval for draft-only',
    ],
    objectiveTypeHint: 'DRAFT_LISTING',
    runnable: true,
  },
  {
    id: 'approved-listing-publication',
    name: 'Approved Listing Publication',
    description:
      'Publish an approved listing draft to the selected sales channel via connector (credential-gated for live merchants).',
    objective:
      'Publish the approved listing to the selected sales channel after founder approval.',
    requiredCapabilities: ['createListing', 'updateListing'],
    optionalCapabilities: [],
    riskClass: 'approval_required',
    expectedStages: [
      'policy_validation',
      'approval_required',
      'executing',
      'verifying',
      'completed',
    ],
    completionCriteria: [
      'publish_listing approval required',
      'external confirmation or fixture marketplace publish',
      'listing status active only after execute',
    ],
    objectiveTypeHint: 'PUBLISH_LISTING',
    runnable: true,
  },
  {
    id: 'customer-order-supplier-fulfillment',
    name: 'Customer Order to Supplier Fulfillment',
    description:
      'Process a paid customer order through supplier PO draft → approval → fulfillment tracking.',
    objective:
      'Process the next paid customer order through the selected supplier and track it until fulfillment.',
    requiredCapabilities: ['readOrders', 'createSupplierOrder', 'readTracking', 'submitFulfillment'],
    optionalCapabilities: ['receiveWebhooks', 'readInventory'],
    riskClass: 'financial_contractual',
    expectedStages: [
      'order_ingest',
      'po_draft',
      'approval_required',
      'supplier_submit',
      'tracking',
      'completed',
    ],
    completionCriteria: [
      'supplier_purchase_order approval',
      'fulfillment state transitions',
    ],
    objectiveTypeHint: 'SUPPLIER_PO',
    runnable: true,
  },
  {
    id: 'margin-protection-workflow',
    name: 'Margin Protection Workflow',
    description:
      'Monitor active products when costs/fees shift expected margin below 20% and propose protective actions.',
    objective:
      'Monitor active products and protect me when supplier cost, fees, or shipping changes reduce expected margin below 20%.',
    requiredCapabilities: ['readProduct', 'readSupplierOffers', 'readMarketplacePrices'],
    optionalCapabilities: ['updateListing', 'pauseListing'],
    riskClass: 'approval_required',
    expectedStages: [
      'refresh_costs',
      'recalculate',
      'detect_breach',
      'propose_action',
      'approval_required',
      'completed',
    ],
    completionCriteria: [
      'margin floor evaluation',
      'explanation of affected listings',
    ],
    objectiveTypeHint: 'MIXED',
    runnable: false, // scheduled trigger not fully wired
  },
];

export function getLiveExample(id: string): LiveExampleDefinition | undefined {
  return LIVE_EXAMPLES.find((e) => e.id === id);
}

export function listLiveExamples(): LiveExampleDefinition[] {
  return LIVE_EXAMPLES;
}

export type CapabilitySnapshot = {
  capability: string;
  available: boolean;
  providerKeys: string[];
  /** fixture vs live-ish */
  dataClass: 'fixture' | 'live' | 'unknown' | 'missing';
};

/**
 * Compute readiness from installed connectors + product store presence.
 * Honest: fixture connectors are not "live".
 */
export function evaluateExampleReadiness(
  example: LiveExampleDefinition,
  input: {
    connectors: Array<{
      providerKey: string;
      status: string;
      isFixture?: boolean;
      capabilities?: string[];
    }>;
    productCount: number;
  },
): {
  readiness: LiveExampleReadiness;
  reason: string;
  capabilities: CapabilitySnapshot[];
  liveConnectorCount: number;
  fixtureConnectorCount: number;
} {
  const live = input.connectors.filter(
    (c) => !c.isFixture && !c.providerKey.startsWith('fixture'),
  );
  const fixture = input.connectors.filter(
    (c) => c.isFixture || c.providerKey.startsWith('fixture'),
  );

  const capSnaps: CapabilitySnapshot[] = example.requiredCapabilities.map((cap) => {
    const providers = input.connectors.filter((c) => {
      const caps = c.capabilities ?? defaultCapsForProvider(c.providerKey);
      return caps.includes(cap) && isConnectedish(c.status);
    });
    const hasLive = providers.some(
      (p) => !p.isFixture && !p.providerKey.startsWith('fixture'),
    );
    const hasFixture = providers.some(
      (p) => p.isFixture || p.providerKey.startsWith('fixture'),
    );
    return {
      capability: cap,
      available: providers.length > 0 || (cap === 'searchProducts' && input.productCount > 0),
      providerKeys: providers.map((p) => p.providerKey),
      dataClass: hasLive
        ? 'live'
        : hasFixture || input.productCount > 0
          ? 'fixture'
          : 'missing',
    };
  });

  const missing = capSnaps.filter((c) => !c.available);
  const onlyFixture =
    capSnaps.every((c) => c.available) &&
    capSnaps.some((c) => c.dataClass === 'fixture') &&
    !capSnaps.some((c) => c.dataClass === 'live');

  if (!example.runnable) {
    return {
      readiness: 'not_implemented',
      reason: 'Example defined; automated schedule/trigger not fully wired.',
      capabilities: capSnaps,
      liveConnectorCount: live.length,
      fixtureConnectorCount: fixture.length,
    };
  }

  if (missing.length > 0 && input.productCount === 0) {
    return {
      readiness: 'credentials_required',
      reason: `Missing capabilities: ${missing.map((m) => m.capability).join(', ')}. Connect a supplier source or import authorized data.`,
      capabilities: capSnaps,
      liveConnectorCount: live.length,
      fixtureConnectorCount: fixture.length,
    };
  }

  if (onlyFixture || (input.productCount > 0 && live.length === 0)) {
    return {
      readiness: 'partially_ready',
      reason:
        'Runnable against product store / fixture-labeled connectors. Not presented as live marketplace data.',
      capabilities: capSnaps,
      liveConnectorCount: live.length,
      fixtureConnectorCount: fixture.length,
    };
  }

  if (live.length > 0 && missing.length === 0) {
    return {
      readiness: 'ready',
      reason: 'Required capabilities available on non-fixture connectors.',
      capabilities: capSnaps,
      liveConnectorCount: live.length,
      fixtureConnectorCount: fixture.length,
    };
  }

  return {
    readiness: 'partially_ready',
    reason: 'Some capabilities available; execution may be partial.',
    capabilities: capSnaps,
    liveConnectorCount: live.length,
    fixtureConnectorCount: fixture.length,
  };
}

function isConnectedish(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'connected' || s.includes('sync') || s === 'healthy';
}

function defaultCapsForProvider(providerKey: string): string[] {
  if (providerKey.includes('supplier') || providerKey.includes('fixture-supplier')) {
    return ['searchProducts', 'readProduct', 'readSupplierOffers', 'readInventory'];
  }
  if (providerKey.includes('marketplace') || providerKey.includes('google')) {
    return ['readMarketplacePrices', 'createListing', 'updateListing', 'readOrders'];
  }
  return ['searchProducts', 'readProduct'];
}
