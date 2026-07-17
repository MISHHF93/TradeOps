import { Injectable } from '@nestjs/common';
import {
  BUSINESS_CAPABILITY_CATALOG,
  businessCapabilitiesFromTechnical,
  listConnectorManifests,
  listLiveFeeds,
  listProductionRuntime,
  selectProvidersForCapabilities,
  type BusinessCapability,
  type CapabilityAdvertisement,
} from '@tradeops/connector-core';
import { STAGE_DEFINITIONS } from '@tradeops/commerce-engine';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ecosystem-first surfaces: capability advertisements, partner value,
 * and a knowledge-graph projection over canonical models.
 */
@Injectable()
export class EcosystemService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full capability board for AI + UI: fixtures, live-feed stubs, org installs.
   */
  async capabilityBoard(organizationId: string) {
    const installations = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
    });
    const installByKey = new Map(installations.map((i) => [i.providerKey, i]));

    const fromManifests: CapabilityAdvertisement[] = listConnectorManifests().map((m) => {
      const inst = installByKey.get(m.id);
      const technical = m.capabilities as string[];
      return {
        providerKey: m.id,
        displayName: m.displayName,
        family: m.family,
        isFixture: m.isFixture,
        apiVersion: m.version,
        status: inst?.status ?? (m.isFixture ? 'connected' : 'not_configured'),
        health: inst?.status ?? 'unknown',
        businessCapabilities: businessCapabilitiesFromTechnical(technical),
        technicalCapabilities: technical,
        supportedOperations: technical,
        notes: m.isFixture ? 'TEST FIXTURE — not a live marketplace' : undefined,
      };
    });

    const fromFeeds: CapabilityAdvertisement[] = listLiveFeeds().map((f) => {
      const inst = installByKey.get(f.providerKey);
      const technical = f.capabilities;
      return {
        providerKey: f.providerKey,
        displayName: f.displayName,
        family: f.family,
        isFixture: f.isFixture,
        authMode: f.authMode,
        apiVersion: f.apiVersion,
        docsUrl: f.docsUrl,
        status: inst?.status ?? (f.isFixture ? 'connected' : 'credentials_required'),
        health: inst?.status ?? 'registry_only',
        businessCapabilities: businessCapabilitiesFromTechnical(technical),
        technicalCapabilities: technical,
        supportedOperations: technical,
        notes: f.notes,
        rateLimitHint: 'Respect provider rate limits; unknown until live connection',
      };
    });

    // Production catalog overlays (business capabilities + env-backed status)
    const fromProduction: CapabilityAdvertisement[] = listProductionRuntime().map((r) => {
      const inst = installByKey.get(r.id);
      return {
        providerKey: r.id,
        displayName: r.displayName,
        family: String(r.category),
        isFixture: false,
        authMode: r.authMethod,
        apiVersion: r.apiVersion,
        docsUrl: r.docsUrl,
        status: inst?.status ?? r.status,
        health: r.liveReady ? 'ok' : 'credentials_required',
        businessCapabilities: r.businessCapabilities,
        technicalCapabilities: r.technicalCapabilities,
        supportedOperations: r.technicalCapabilities,
        notes: r.lastSyncHint,
        rateLimitHint: r.rateLimitRpm
          ? `~${r.rateLimitRpm} rpm`
          : 'Respect provider rate limits',
      };
    });

    // Dedupe by providerKey (prefer install-backed manifest)
    const byKey = new Map<string, CapabilityAdvertisement>();
    for (const a of [...fromFeeds, ...fromProduction, ...fromManifests]) {
      const prev = byKey.get(a.providerKey);
      if (!prev || (!prev.isFixture && a.isFixture === false && a.technicalCapabilities.length > 0)) {
        byKey.set(a.providerKey, { ...prev, ...a, ...(prev ? { businessCapabilities: a.businessCapabilities } : {}) });
      } else if (!prev) {
        byKey.set(a.providerKey, a);
      } else {
        // merge business caps
        const merged = new Set([
          ...prev.businessCapabilities,
          ...a.businessCapabilities,
        ]);
        byKey.set(a.providerKey, {
          ...prev,
          businessCapabilities: [...merged].sort() as BusinessCapability[],
          technicalCapabilities: [
            ...new Set([...prev.technicalCapabilities, ...a.technicalCapabilities]),
          ],
        });
      }
    }

    const advertisements = [...byKey.values()].sort((a, b) =>
      a.providerKey.localeCompare(b.providerKey),
    );

    return {
      domain: 'connector_capabilities' as const,
      catalog: BUSINESS_CAPABILITY_CATALOG,
      advertisements,
      honesty: {
        note: 'AI reasons over business capabilities, not vendor REST endpoints. Live execution requires auth + healthy connector — registry-only entries cannot run live.',
      },
    };
  }

  selectConnectors(
    advertisements: CapabilityAdvertisement[],
    required: BusinessCapability[],
  ) {
    return {
      required,
      ranked: selectProvidersForCapabilities(advertisements, required),
      note: 'Dynamic selection by capability coverage, fixture vs live preference, and health.',
    };
  }

  /**
   * Partner Success Center — value created for ecosystem participants (org-scoped metrics).
   * Honest: no fabricated GMV for partners we are not connected to live.
   */
  async partnerSuccessCenter(organizationId: string) {
    const [
      products,
      cases,
      listings,
      orders,
      connectors,
      operatorRuns,
      payments,
      artifacts,
    ] = await Promise.all([
      this.prisma.client.product.count({ where: { organizationId } }),
      this.prisma.client.commerceCase.count({ where: { organizationId } }),
      this.prisma.client.listing.count({ where: { organizationId } }),
      this.prisma.client.customerOrder.count({ where: { organizationId } }),
      this.prisma.client.connectorInstallation.findMany({ where: { organizationId } }),
      this.prisma.client.operatorRun.count({ where: { organizationId } }),
      this.prisma.client.commercePayment.count({ where: { organizationId } }),
      this.prisma.client.productArtifact.count({ where: { organizationId } }),
    ]);

    const fixtureConnectors = connectors.filter((c) => c.isFixture).length;
    const liveConnectors = connectors.filter((c) => !c.isFixture).length;
    const connected = connectors.filter((c) => c.status === 'connected').length;

    const partners = [
      {
        partnerKey: 'merchant',
        displayName: 'Merchant (this organization)',
        valueCreated: [
          'Single process spine for every product opportunity',
          'AI-assisted evaluation and listing preparation',
          'Channel payment intelligence without card custody',
        ],
        metrics: {
          products,
          commerceCases: cases,
          listings,
          orders,
          aiRuns: operatorRuns,
          mediaArtifacts: artifacts,
        },
        status: products > 0 ? 'active' : 'needs_onboarding',
      },
      {
        partnerKey: 'shopify',
        displayName: 'Shopify',
        valueCreated: [
          'Higher-quality merchants and catalog readiness (when connected)',
          'GraphQL Admin capability path registered',
        ],
        metrics: {
          connectorPresent: connectors.some((c) => c.providerKey.includes('shopify')),
          registryOnly: true,
        },
        status: 'registry_capability_not_live',
        honesty: 'No live Shopify connector package yet — capability advertised only.',
      },
      {
        partnerKey: 'marketplaces',
        displayName: 'Amazon / eBay (registry)',
        valueCreated: ['Canonical listings prepared for multichannel publish when authorized'],
        metrics: { liveConnectors, fixtureConnectors },
        status: liveConnectors > 0 ? 'partial' : 'planned',
      },
      {
        partnerKey: 'suppliers',
        displayName: 'Suppliers',
        valueCreated: ['Qualified demand from evaluated opportunities', 'Fixture supplier loop operational'],
        metrics: {
          fixtureSupplier: connectors.some((c) => c.providerKey === 'fixture-supplier'),
        },
        status: 'fixture_operational',
      },
      {
        partnerKey: 'stripe_saas',
        displayName: 'Stripe (SaaS billing)',
        valueCreated: ['Subscription volume for TradeOps access', 'No investment custody'],
        metrics: { note: 'Platform-level; org plan on Organization.planTier' },
        status: 'saas_billing_path',
      },
      {
        partnerKey: 'google_merchant',
        displayName: 'Google Merchant Center',
        valueCreated: ['Higher-quality product feeds when credentials present'],
        metrics: {
          installed: connectors.some((c) => c.providerKey.includes('google')),
        },
        status: 'credential_gated',
      },
      {
        partnerKey: 'logistics',
        displayName: 'Logistics (ShipStation, carriers)',
        valueCreated: ['Fulfillment monitoring demand when connectors live'],
        metrics: {},
        status: 'planned',
      },
      {
        partnerKey: 'tradeops',
        displayName: 'TradeOps',
        valueCreated: [
          'SaaS subscription revenue',
          'Premium AI automation (entitlements)',
          'Workflow orchestration',
        ],
        metrics: {
          connectorInstallations: connectors.length,
          connected,
          paymentsNormalized: payments,
        },
        status: 'operating',
      },
    ];

    return {
      domain: 'partner_success' as const,
      organizationId,
      partners,
      ecosystemPrinciple:
        'TradeOps increases value for every participant — it does not compete with channels or processors.',
      honesty: {
        note: 'Metrics are org-scoped and honest. Registry-only partners show planned status — never fabricated GMV.',
      },
    };
  }

  /**
   * Knowledge graph projection: nodes + edges from canonical tables.
   * Not a separate graph database — queryable intelligence model over existing data.
   */
  async knowledgeGraph(organizationId: string, limit = 40) {
    const [products, cases, suppliers, listings, orders, payments] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { organizationId },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          sourcePlatform: true,
          category: true,
          targetPriceMinor: true,
          currency: true,
        },
      }),
      this.prisma.client.commerceCase.findMany({
        where: { organizationId },
        take: limit,
        select: {
          id: true,
          productId: true,
          currentStage: true,
          stageStatus: true,
          nextActionCode: true,
          opportunityScore: true,
        },
      }),
      this.prisma.client.supplier.findMany({
        where: { organizationId },
        take: 30,
        select: { id: true, name: true, externalId: true },
      }),
      this.prisma.client.listing.findMany({
        where: { organizationId },
        take: limit,
        select: { id: true, productId: true, status: true, salesChannelId: true },
      }),
      this.prisma.client.customerOrder.findMany({
        where: { organizationId },
        take: limit,
        select: { id: true, externalId: true, status: true, totalMinor: true, currency: true },
      }),
      this.prisma.client.commercePayment.findMany({
        where: { organizationId },
        take: limit,
        select: {
          id: true,
          customerOrderId: true,
          status: true,
          capturedAmountMinor: true,
          currency: true,
        },
      }),
    ]);

    const nodes: Array<{
      id: string;
      type: string;
      label: string;
      meta?: Record<string, unknown>;
    }> = [];
    const edges: Array<{ from: string; to: string; rel: string }> = [];

    for (const p of products) {
      nodes.push({
        id: `product:${p.id}`,
        type: 'Product',
        label: p.title,
        meta: { sourcePlatform: p.sourcePlatform, category: p.category },
      });
    }
    for (const c of cases) {
      nodes.push({
        id: `case:${c.id}`,
        type: 'CommerceCase',
        label: `${c.currentStage} · ${c.stageStatus}`,
        meta: {
          nextAction: c.nextActionCode,
          score: c.opportunityScore,
        },
      });
      edges.push({ from: `case:${c.id}`, to: `product:${c.productId}`, rel: 'case_for_product' });
    }
    for (const s of suppliers) {
      nodes.push({
        id: `supplier:${s.id}`,
        type: 'Supplier',
        label: s.name,
        meta: { externalId: s.externalId },
      });
    }
    for (const l of listings) {
      nodes.push({
        id: `listing:${l.id}`,
        type: 'Listing',
        label: l.status,
      });
      edges.push({ from: `listing:${l.id}`, to: `product:${l.productId}`, rel: 'lists_product' });
    }
    for (const o of orders) {
      nodes.push({
        id: `order:${o.id}`,
        type: 'CustomerOrder',
        label: o.externalId,
        meta: { status: o.status, totalMinor: o.totalMinor },
      });
    }
    for (const pay of payments) {
      nodes.push({
        id: `payment:${pay.id}`,
        type: 'CommercePayment',
        label: pay.status,
        meta: { captured: pay.capturedAmountMinor },
      });
      edges.push({
        from: `payment:${pay.id}`,
        to: `order:${pay.customerOrderId}`,
        rel: 'pays_for_order',
      });
    }

    // Learning edges: cases in learn/reconcile
    for (const c of cases.filter((x) => x.currentStage === 'learn' || x.currentStage === 'reconcile')) {
      edges.push({
        from: `case:${c.id}`,
        to: `product:${c.productId}`,
        rel: 'learning_outcome',
      });
    }

    return {
      domain: 'commerce_knowledge_graph' as const,
      organizationId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      lifecycle: STAGE_DEFINITIONS.map((s) => ({ id: s.id, title: s.title })),
      honesty: {
        note: 'Projection over canonical Prisma models — not a separate graph database. Preserves organization isolation.',
      },
    };
  }

  /**
   * Actionable operational intelligence for command center.
   * Answers: what happened, why, next, who, AI?, value.
   */
  async operationalIntelligence(organizationId: string) {
    const summary = await this.prisma.client.commerceCase.groupBy({
      by: ['currentStage', 'stageStatus'],
      where: { organizationId },
      _count: true,
    });
    const blocked = await this.prisma.client.commerceCase.count({
      where: { organizationId, stageStatus: 'blocked' },
    });
    const waiting = await this.prisma.client.commerceCase.count({
      where: { organizationId, stageStatus: 'waiting' },
    });
    const pendingApprovals = await this.prisma.client.approval.count({
      where: { organizationId, status: 'pending' },
    });
    const productCount = await this.prisma.client.product.count({ where: { organizationId } });

    const nextActions: Array<{
      whatHappened: string;
      why: string;
      next: string;
      who: string;
      aiCanAutomate: boolean;
      value: string;
      href: string;
    }> = [];

    if (productCount === 0) {
      nextActions.push({
        whatHappened: 'No products in the canonical catalog yet.',
        why: 'Connectors have not imported supplier or marketplace candidates.',
        next: 'Import fixture supplier catalog or connect an authorized supplier feed.',
        who: 'Operator',
        aiCanAutomate: true,
        value: 'Starts Discover → Evaluate without manual marketplace browsing.',
        href: '/terminal',
      });
    }
    if (pendingApprovals > 0) {
      nextActions.push({
        whatHappened: `${pendingApprovals} approval(s) waiting.`,
        why: 'Consequential publish or purchase requires human gate.',
        next: 'Review approvals and decide approve/reject with evidence.',
        who: 'Owner / operator',
        aiCanAutomate: false,
        value: 'Unblocks Publish / Source stages safely.',
        href: '/terminal/approvals',
      });
    }
    if (blocked > 0) {
      nextActions.push({
        whatHappened: `${blocked} commerce case(s) blocked.`,
        why: 'Policy, payment, media rights, or connector health blockers.',
        next: 'Open Process board and clear blockers on each case.',
        who: 'Operator + AI assist (explain)',
        aiCanAutomate: false,
        value: 'Restores flow through the lifecycle spine.',
        href: '/terminal/process',
      });
    }
    if (waiting > 0) {
      nextActions.push({
        whatHappened: `${waiting} case(s) waiting on external state.`,
        why: 'Orders, payouts, or connector events not yet advanced.',
        next: 'Ingest orders / sync process or wait for verified webhooks.',
        who: 'System + operator',
        aiCanAutomate: true,
        value: 'Moves Sell → Fulfill → Reconcile with real evidence.',
        href: '/terminal/orders',
      });
    }
    if (nextActions.length === 0) {
      nextActions.push({
        whatHappened: 'Workspace has product cases without critical blockers.',
        why: 'Process spine is healthy enough to optimize.',
        next: 'Run AI Operator on top opportunities or advance cases on the Process board.',
        who: 'Operator + AI',
        aiCanAutomate: true,
        value: 'Continuous learn loop improves recommendations.',
        href: '/terminal/process',
      });
    }

    return {
      domain: 'operational_intelligence' as const,
      stageHistogram: summary.map((s) => ({
        stage: s.currentStage,
        status: s.stageStatus,
        count: s._count,
      })),
      nextActions,
      emptyStateEducation:
        productCount === 0
          ? {
              title: 'Start the commerce process',
              body: 'TradeOps is not an empty dashboard — it is an operating procedure. Import products or connect a supplier, then open Process to follow Discover → Learn.',
              cta: { label: 'Open Discover', href: '/terminal' },
            }
          : null,
    };
  }
}
