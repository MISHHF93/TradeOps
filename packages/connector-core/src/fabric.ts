/**
 * Connector Fabric helpers — uniform surface for fixtures and live providers.
 */

import { businessCapabilitiesFromTechnical } from './business-capabilities';
import { getConnectorManifest, listConnectorManifests } from './registry';
import type { ConnectorManifest, ConnectorStatus } from './types';

export type FabricConnectorDescriptor = {
  providerKey: string;
  displayName: string;
  family: string;
  isFixture: boolean;
  version: string;
  capabilities: string[];
  businessCapabilities: string[];
  auth: {
    mode: string;
    credentialKeys: string[];
    docsUrl?: string;
  };
  rateLimit: {
    requestsPerMinute?: number;
    burst?: number;
    notes?: string;
  };
  sync: {
    webhooks: boolean;
    polling: boolean;
    defaultPollIntervalSeconds?: number;
    supportsIncremental?: boolean;
  };
  operations: Array<{
    operation: string;
    capability: string;
    idempotent: boolean;
    approvalRequired: boolean;
    produces?: string;
  }>;
  docsUrl?: string;
  healthCheck: string;
  /** Contract parity note */
  contract: {
    sameInterfaceAsLive: boolean;
    note: string;
  };
};

export function describeFabricConnector(manifest: ConnectorManifest): FabricConnectorDescriptor {
  const auth = manifest.auth ?? {
    mode: manifest.isFixture ? 'none' : 'api_key',
    credentialKeys: [],
  };
  const sync = manifest.sync ?? {
    webhooks: false,
    polling: true,
    defaultPollIntervalSeconds: manifest.isFixture ? 0 : 300,
    supportsIncremental: false,
  };
  const rateLimit = manifest.rateLimit ?? {
    requestsPerMinute: manifest.isFixture ? 600 : 60,
    notes: manifest.isFixture
      ? 'Fixture: high limit; still reports rate_limited status when simulated.'
      : undefined,
  };
  const operations =
    manifest.operations ??
    manifest.capabilities.map((c) => ({
      operation: c,
      capability: c,
      idempotent: !String(c).startsWith('create') && !String(c).startsWith('submit'),
      approvalRequired: ['createListing', 'createSupplierOrder', 'submitFulfillment'].includes(c),
      produces: undefined as string | undefined,
    }));

  return {
    providerKey: manifest.id,
    displayName: manifest.displayName,
    family: manifest.family,
    isFixture: manifest.isFixture,
    version: manifest.version,
    capabilities: [...manifest.capabilities],
    businessCapabilities: businessCapabilitiesFromTechnical([...manifest.capabilities]),
    auth: {
      mode: auth.mode,
      credentialKeys: auth.credentialKeys,
      docsUrl: auth.docsUrl ?? manifest.docsUrl,
    },
    rateLimit,
    sync,
    operations: operations.map((o) => ({
      operation: o.operation,
      capability: String(o.capability),
      idempotent: o.idempotent,
      approvalRequired: o.approvalRequired,
      produces: o.produces,
    })),
    docsUrl: manifest.docsUrl,
    healthCheck: manifest.healthCheck ?? (manifest.isFixture ? 'capability_probe' : 'credentials'),
    contract: {
      sameInterfaceAsLive: true,
      note: manifest.isFixture
        ? 'Fixture satisfies the same connector interface as live; swap via credentials/config only.'
        : 'Live connector; requires authorized credentials before connected status.',
    },
  };
}

export function listFabricConnectors(): FabricConnectorDescriptor[] {
  return listConnectorManifests()
    .map(describeFabricConnector)
    .sort((a, b) => a.providerKey.localeCompare(b.providerKey));
}

export function getFabricConnector(providerKey: string): FabricConnectorDescriptor | undefined {
  const m = getConnectorManifest(providerKey);
  return m ? describeFabricConnector(m) : undefined;
}

/**
 * Normalized fabric health view — never exposes secrets.
 */
export function fabricHealthSummary(
  installs: Array<{ providerKey: string; status: string; isFixture?: boolean }>,
): {
  total: number;
  fixtures: number;
  liveHealthy: number;
  needsCredentials: number;
  unhealthy: number;
  descriptors: FabricConnectorDescriptor[];
} {
  const descriptors = listFabricConnectors();
  const byKey = new Map(installs.map((i) => [i.providerKey, i]));
  let liveHealthy = 0;
  let needsCredentials = 0;
  let unhealthy = 0;
  let fixtures = 0;
  for (const d of descriptors) {
    const inst = byKey.get(d.providerKey);
    if (d.isFixture) fixtures += 1;
    const status = (inst?.status ?? 'not_configured') as ConnectorStatus | string;
    if (status === 'connected' || String(status).includes('sync')) {
      if (!d.isFixture) liveHealthy += 1;
    } else if (
      status === 'not_configured' ||
      status === 'credentials_required' ||
      String(status).includes('expir')
    ) {
      if (!d.isFixture) needsCredentials += 1;
    } else if (status === 'unhealthy' || status === 'rate_limited') {
      unhealthy += 1;
    }
  }
  return {
    total: descriptors.length,
    fixtures,
    liveHealthy,
    needsCredentials,
    unhealthy,
    descriptors,
  };
}
