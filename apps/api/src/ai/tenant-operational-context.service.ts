import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TenantOperationalSnapshot = {
  products: Array<Record<string, unknown>>;
  inventory: {
    items: Array<Record<string, unknown>>;
    lowStock: Array<Record<string, unknown>>;
    totalUnits: number;
    productCount: number;
  };
  orders: Array<Record<string, unknown>>;
  orderList: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  shipments: Array<Record<string, unknown>>;
  cases: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
  revenue: {
    orderCount: number;
    totalMinor: number;
    currency: string;
    paymentCapturedMinor: number;
    source: string;
  };
  connectors: Array<Record<string, unknown>>;
  connectorHealth: Array<Record<string, unknown>>;
  meta: {
    organizationId: string;
    dataClass: 'LIVE' | 'TEST_FIXTURE' | 'EMPTY' | 'MIXED';
    productCount: number;
    fixtureProductCount: number;
    liveProductCount: number;
    openCaseCount: number;
    orderCount: number;
    connectorCount: number;
    liveConnectorCount: number;
    generatedAt: string;
  };
};

const PRODUCT_TAKE = 50;
const ORDER_TAKE = 30;
const CASE_TAKE = 25;
const SUPPLIER_TAKE = 25;
const PAYMENT_TAKE = 30;
const FULFILLMENT_TAKE = 30;

/**
 * Builds a tenant-scoped operational snapshot for the Cohere agent loop.
 * Capability tools only see this context — they never invent marketplace truth.
 */
@Injectable()
export class TenantOperationalContextService {
  private readonly logger = new Logger(TenantOperationalContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildSnapshot(organizationId: string): Promise<TenantOperationalSnapshot> {
    /** One failed domain must not drop the whole snapshot (chat needs products even if payments fail). */
    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        this.logger.warn(
          `Snapshot slice "${label}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return fallback;
      }
    };

    const productsRaw = await safe(
      'products',
      () =>
        this.prisma.client.product.findMany({
          where: { organizationId },
          orderBy: { updatedAt: 'desc' },
          take: PRODUCT_TAKE,
          select: {
            id: true,
            title: true,
            category: true,
            sourcePlatform: true,
            externalId: true,
            currency: true,
            supplierCostMinor: true,
            shippingCostMinor: true,
            targetPriceMinor: true,
            inventoryQuantity: true,
            rating: true,
            reviewCount: true,
            dataConfidence: true,
            brand: true,
            countryOfOrigin: true,
            dataFreshnessAt: true,
          },
        }),
      [],
    );
    const connectors = await safe(
      'connectors',
      () =>
        this.prisma.client.connectorInstallation.findMany({
          where: { organizationId },
          take: 80,
          select: {
            providerKey: true,
            displayName: true,
            family: true,
            status: true,
            isFixture: true,
            lastHealthAt: true,
            lastError: true,
          },
        }),
      [],
    );
    const casesRaw = await safe(
      'cases',
      () =>
        this.prisma.client.commerceCase.findMany({
          where: {
            organizationId,
            stageStatus: { notIn: ['completed', 'failed'] },
          },
          orderBy: { updatedAt: 'desc' },
          take: CASE_TAKE,
          select: {
            id: true,
            productId: true,
            currentStage: true,
            stageStatus: true,
            opportunityScore: true,
            confidence: true,
            nextActionCode: true,
            nextActionLabel: true,
            blockerCode: true,
            blockerMessage: true,
            recommendation: true,
            expectedProfitMinor: true,
          },
        }),
      [],
    );
    const ordersRaw = await safe(
      'orders',
      () =>
        this.prisma.client.customerOrder.findMany({
          where: { organizationId },
          orderBy: { placedAt: 'desc' },
          take: ORDER_TAKE,
          select: {
            id: true,
            sourcePlatform: true,
            externalId: true,
            status: true,
            currency: true,
            totalMinor: true,
            placedAt: true,
          },
        }),
      [],
    );
    const paymentsRaw = await safe(
      'payments',
      () =>
        this.prisma.client.commercePayment.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: PAYMENT_TAKE,
          select: {
            id: true,
            channel: true,
            provider: true,
            status: true,
            currency: true,
            authorizedAmountMinor: true,
            capturedAmountMinor: true,
            refundedAmountMinor: true,
            netAmountMinor: true,
            createdAt: true,
          },
        }),
      [],
    );
    const fulfillmentsRaw = await safe(
      'fulfillments',
      () =>
        this.prisma.client.fulfillment.findMany({
          where: { organizationId },
          orderBy: { updatedAt: 'desc' },
          take: FULFILLMENT_TAKE,
          select: {
            id: true,
            customerOrderId: true,
            status: true,
            trackingNumber: true,
            carrier: true,
            updatedAt: true,
          },
        }),
      [],
    );
    const suppliersRaw = await safe(
      'suppliers',
      () =>
        this.prisma.client.supplier.findMany({
          where: { organizationId },
          orderBy: { updatedAt: 'desc' },
          take: SUPPLIER_TAKE,
          select: {
            id: true,
            name: true,
            sourcePlatform: true,
            reliabilityScore: true,
            dataConfidence: true,
          },
        }),
      [],
    );

    const products = productsRaw.map((p) => {
      const isFixture =
        p.sourcePlatform.startsWith('fixture') ||
        (p.sourcePlatform ?? '').toLowerCase().includes('demo');
      const marginMinor =
        p.targetPriceMinor - p.supplierCostMinor - p.shippingCostMinor;
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        sourcePlatform: p.sourcePlatform,
        externalId: p.externalId,
        currency: p.currency,
        supplierCostMinor: p.supplierCostMinor,
        shippingCostMinor: p.shippingCostMinor,
        targetPriceMinor: p.targetPriceMinor,
        inventoryQuantity: p.inventoryQuantity,
        marginMinor,
        rating: p.rating,
        reviewCount: p.reviewCount,
        dataConfidence: p.dataConfidence,
        brand: p.brand,
        countryOfOrigin: p.countryOfOrigin,
        dataFreshnessAt: p.dataFreshnessAt?.toISOString?.() ?? p.dataFreshnessAt,
        isFixture,
      };
    });

    const inventoryItems = products.map((p) => ({
      productId: p.id,
      title: p.title,
      quantity: p.inventoryQuantity,
      sourcePlatform: p.sourcePlatform,
      isFixture: p.isFixture,
      lowStock: Number(p.inventoryQuantity) <= 5,
    }));
    const lowStock = inventoryItems.filter((i) => i.lowStock);
    const totalUnits = inventoryItems.reduce(
      (sum, i) => sum + Number(i.quantity ?? 0),
      0,
    );

    const orders = ordersRaw.map((o) => ({
      id: o.id,
      sourcePlatform: o.sourcePlatform,
      externalId: o.externalId,
      status: o.status,
      currency: o.currency,
      totalMinor: o.totalMinor,
      placedAt: o.placedAt?.toISOString?.() ?? o.placedAt,
    }));

    const payments = paymentsRaw.map((pay) => ({
      id: pay.id,
      channel: pay.channel,
      provider: pay.provider,
      status: pay.status,
      currency: pay.currency,
      authorizedAmountMinor: pay.authorizedAmountMinor,
      capturedAmountMinor: pay.capturedAmountMinor,
      refundedAmountMinor: pay.refundedAmountMinor,
      netAmountMinor: pay.netAmountMinor,
      createdAt: pay.createdAt?.toISOString?.() ?? pay.createdAt,
    }));

    const shipments = fulfillmentsRaw.map((f) => ({
      id: f.id,
      customerOrderId: f.customerOrderId,
      status: f.status,
      trackingNumber: f.trackingNumber,
      carrier: f.carrier,
      updatedAt: f.updatedAt?.toISOString?.() ?? f.updatedAt,
    }));

    const cases = casesRaw.map((c) => ({
      id: c.id,
      productId: c.productId,
      currentStage: c.currentStage,
      stageStatus: c.stageStatus,
      opportunityScore: c.opportunityScore,
      confidence: c.confidence,
      nextActionCode: c.nextActionCode,
      nextActionLabel: c.nextActionLabel,
      blockerCode: c.blockerCode,
      blockerMessage: c.blockerMessage,
      recommendation: c.recommendation,
      expectedProfitMinor: c.expectedProfitMinor,
    }));

    const suppliers = suppliersRaw.map((s) => ({
      id: s.id,
      name: s.name,
      sourcePlatform: s.sourcePlatform,
      reliabilityScore: s.reliabilityScore,
      dataConfidence: s.dataConfidence,
    }));

    const connectorsMapped = connectors.map((c) => ({
      providerKey: c.providerKey,
      displayName: c.displayName,
      family: c.family,
      status: String(c.status),
      isFixture: c.isFixture || c.providerKey.startsWith('fixture'),
      lastHealthAt: c.lastHealthAt?.toISOString?.() ?? c.lastHealthAt,
      lastError: c.lastError,
    }));

    const fixtureProductCount = products.filter((p) => p.isFixture).length;
    const liveProductCount = products.length - fixtureProductCount;
    const liveConnectorCount = connectorsMapped.filter(
      (c) => !c.isFixture && c.status !== 'not_configured',
    ).length;

    let dataClass: TenantOperationalSnapshot['meta']['dataClass'] = 'EMPTY';
    if (products.length === 0 && orders.length === 0) {
      dataClass = 'EMPTY';
    } else if (liveProductCount > 0 && fixtureProductCount > 0) {
      dataClass = 'MIXED';
    } else if (liveProductCount > 0) {
      dataClass = 'LIVE';
    } else if (fixtureProductCount > 0) {
      dataClass = 'TEST_FIXTURE';
    } else {
      dataClass = 'EMPTY';
    }

    const orderTotalMinor = orders.reduce((s, o) => s + Number(o.totalMinor ?? 0), 0);
    const paymentCapturedMinor = payments.reduce(
      (s, p) => s + Number(p.capturedAmountMinor ?? 0),
      0,
    );
    const currency =
      orders[0]?.currency ?? payments[0]?.currency ?? products[0]?.currency ?? 'USD';

    const snapshot: TenantOperationalSnapshot = {
      products,
      inventory: {
        items: inventoryItems,
        lowStock,
        totalUnits,
        productCount: products.length,
      },
      orders,
      orderList: orders,
      payments,
      transactions: payments,
      shipments,
      cases,
      suppliers,
      revenue: {
        orderCount: orders.length,
        totalMinor: orderTotalMinor,
        currency: String(currency),
        paymentCapturedMinor,
        source:
          orders.length || payments.length
            ? 'tenant_orders_payments'
            : 'none',
      },
      connectors: connectorsMapped,
      connectorHealth: connectorsMapped,
      meta: {
        organizationId,
        dataClass,
        productCount: products.length,
        fixtureProductCount,
        liveProductCount,
        openCaseCount: cases.length,
        orderCount: orders.length,
        connectorCount: connectorsMapped.length,
        liveConnectorCount,
        generatedAt: new Date().toISOString(),
      },
    };

    this.logger.debug(
      `Operational snapshot org=${organizationId.slice(0, 8)} products=${products.length} live=${liveProductCount} class=${dataClass}`,
    );

    return snapshot;
  }

  /**
   * Merge client-provided operationalContext over the tenant snapshot.
   * Snapshot fills gaps; explicit client keys win.
   */
  mergeWithClient(
    snapshot: TenantOperationalSnapshot,
    client?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!client || Object.keys(client).length === 0) {
      return snapshot as unknown as Record<string, unknown>;
    }
    return {
      ...(snapshot as unknown as Record<string, unknown>),
      ...client,
      meta: {
        ...snapshot.meta,
        ...(typeof client.meta === 'object' && client.meta
          ? (client.meta as Record<string, unknown>)
          : {}),
        mergedWithClient: true,
      },
    };
  }
}
