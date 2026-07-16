import type { ConnectorManifest } from './types';

const manifests = new Map<string, ConnectorManifest>();

export function registerConnectorManifest(manifest: ConnectorManifest): void {
  manifests.set(manifest.id, manifest);
}

export function getConnectorManifest(id: string): ConnectorManifest | undefined {
  return manifests.get(id);
}

export function listConnectorManifests(): ConnectorManifest[] {
  return [...manifests.values()];
}

export function connectorSupports(
  manifest: ConnectorManifest,
  capability: string,
): boolean {
  return manifest.capabilities.includes(capability as never);
}
