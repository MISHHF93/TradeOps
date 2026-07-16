import {
  registerConnectorManifest,
  type CanonicalProductOffer,
  type ConnectorManifest,
  type SupplierConnector,
} from '@tradeops/connector-core';
import { FIXTURE_SUPPLIER_CATALOG } from './catalog';

export const fixtureSupplierManifest: ConnectorManifest = {
  id: 'fixture-supplier',
  displayName: 'Fixture Supplier (DEV)',
  family: 'supplier',
  isFixture: true,
  version: '0.1.0',
  capabilities: ['searchProducts', 'readProduct', 'readSupplier', 'readInventory', 'quoteShipping'],
};

registerConnectorManifest(fixtureSupplierManifest);

export class FixtureSupplierConnector implements SupplierConnector {
  readonly manifest = fixtureSupplierManifest;

  async searchProducts(query: string): Promise<CanonicalProductOffer[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return FIXTURE_SUPPLIER_CATALOG;
    }
    return FIXTURE_SUPPLIER_CATALOG.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.externalId.toLowerCase().includes(q),
    );
  }

  async readInventory(externalId: string): Promise<{ quantity: number }> {
    const item = FIXTURE_SUPPLIER_CATALOG.find((p) => p.externalId === externalId);
    return { quantity: item?.inventoryQuantity ?? 0 };
  }
}

export { FIXTURE_SUPPLIER_CATALOG };
