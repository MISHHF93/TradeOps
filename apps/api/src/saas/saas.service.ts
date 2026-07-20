import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  defaultPersonaForSegment,
  defaultPlanForSegment,
  entitlementsForPlan,
  listCapabilityPacks,
  type CustomerSegment,
  type PlanTier,
  type WorkspacePersona,
} from '@tradeops/saas-entitlements';
import {
  analyzeCustomer,
  calculateAtp,
  recommendBestChannel,
  scoreAgenticReadiness,
} from '@tradeops/commerce-engine';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../identity/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyOrganizationName } from '@tradeops/domain';

function periodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class SaasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  listPacks() {
    return { packs: listCapabilityPacks() };
  }

  async getTenantContext(organizationId: string, userId: string) {
    const org = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const membership = await this.prisma.client.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const limits = entitlementsForPlan(org.planTier as PlanTier);
    const productCount = await this.prisma.client.product.count({ where: { organizationId } });
    const connectorCount = await this.prisma.client.connectorInstallation.count({
      where: { organizationId },
    });
    const channelCount = await this.prisma.client.salesChannel.count({ where: { organizationId } });
    const seatCount = await this.prisma.client.membership.count({ where: { organizationId } });
    const period = periodKey();
    const aiUsage = await this.prisma.client.usageMeter.findUnique({
      where: {
        organizationId_metricKey_periodKey: {
          organizationId,
          metricKey: 'ai_evaluations',
          periodKey: period,
        },
      },
    });
    const workflowUsage = await this.prisma.client.usageMeter.findUnique({
      where: {
        organizationId_metricKey_periodKey: {
          organizationId,
          metricKey: 'workflow_runs',
          periodKey: period,
        },
      },
    });

    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        segment: org.segment,
        planTier: org.planTier,
        deploymentMode: org.deploymentMode,
        parentOrganizationId: org.parentOrganizationId,
        businessModel: org.businessModel,
        onboardingStep: org.onboardingStep,
        onboardingComplete: org.onboardingComplete,
      },
      membership: {
        role: membership.role,
        workspacePersona: membership.workspacePersona,
      },
      entitlements: limits,
      usage: {
        period,
        products: productCount,
        connectors: connectorCount,
        stores: channelCount,
        seats: seatCount,
        aiEvaluations: aiUsage?.quantity ?? 0,
        workflowRuns: workflowUsage?.quantity ?? 0,
      },
      quotas: {
        products: {
          current: productCount,
          limit: limits.maxProducts,
          ok: productCount < limits.maxProducts,
        },
        connectors: {
          current: connectorCount,
          limit: limits.maxConnectors,
          ok: connectorCount < limits.maxConnectors,
        },
        stores: {
          current: channelCount,
          limit: limits.maxStores,
          ok: channelCount < limits.maxStores,
        },
        seats: {
          current: seatCount,
          limit: limits.maxTeamSeats,
          ok: seatCount < limits.maxTeamSeats,
        },
        aiEvaluations: {
          current: aiUsage?.quantity ?? 0,
          limit: limits.maxAiEvaluationsPerMonth,
          ok: (aiUsage?.quantity ?? 0) < limits.maxAiEvaluationsPerMonth,
        },
        workflowRuns: {
          current: workflowUsage?.quantity ?? 0,
          limit: limits.maxWorkflowRunsPerMonth,
          ok: (workflowUsage?.quantity ?? 0) < limits.maxWorkflowRunsPerMonth,
        },
      },
    };
  }

  async updateOnboarding(
    organizationId: string,
    userId: string,
    input: {
      segment?: CustomerSegment;
      businessModel?: string;
      onboardingStep?: string;
      onboardingComplete?: boolean;
      workspacePersona?: WorkspacePersona;
    },
  ) {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenException('Only owners/admins can update onboarding');
    }

    const data: Record<string, unknown> = {};
    if (input.segment) {
      data.segment = input.segment;
      data.planTier = defaultPlanForSegment(input.segment);
    }
    if (input.businessModel !== undefined) data.businessModel = input.businessModel;
    if (input.onboardingStep) data.onboardingStep = input.onboardingStep;
    if (input.onboardingComplete !== undefined) data.onboardingComplete = input.onboardingComplete;

    const org = await this.prisma.client.organization.update({
      where: { id: organizationId },
      data,
    });

    if (input.workspacePersona || input.segment) {
      await this.prisma.client.membership.update({
        where: { id: membership.id },
        data: {
          workspacePersona:
            input.workspacePersona ??
            defaultPersonaForSegment((input.segment ?? org.segment) as CustomerSegment),
        },
      });
    }

    await this.audit.write({
      action: 'saas.onboarding_update',
      resourceType: 'organization',
      resourceId: organizationId,
      organizationId,
      actorUserId: userId,
      metadata: input as Record<string, unknown>,
    });

    return this.getTenantContext(organizationId, userId);
  }

  async setWorkspacePersona(organizationId: string, userId: string, persona: WorkspacePersona) {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member');
    await this.prisma.client.membership.update({
      where: { id: membership.id },
      data: { workspacePersona: persona },
    });
    return { workspacePersona: persona };
  }

  async incrementUsage(organizationId: string, metricKey: string, by = 1) {
    const period = periodKey();
    return this.prisma.client.usageMeter.upsert({
      where: {
        organizationId_metricKey_periodKey: { organizationId, metricKey, periodKey: period },
      },
      create: {
        organizationId,
        metricKey,
        periodKey: period,
        quantity: by,
      },
      update: { quantity: { increment: by } },
    });
  }

  /**
   * Server-side entitlement gate. Throws ForbiddenException when over quota.
   * Founder-direct local mode never blocks AI evaluations.
   */
  async assertAiEvaluationAllowed(organizationId: string): Promise<void> {
    await this.billing.assertBillingAccess(organizationId);
    // Local product / founder testing must never hit SaaS quota walls
    if ((process.env.TRADEOPS_ACCESS_MODE || 'founder_direct') === 'founder_direct') {
      return;
    }
    if (
      process.env.TRADEOPS_DISABLE_AI_QUOTA === '1' ||
      process.env.TRADEOPS_DISABLE_AI_QUOTA === 'true'
    ) {
      return;
    }
    const org = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const limits = entitlementsForPlan(org.planTier as PlanTier);
    const period = periodKey();
    const usage = await this.prisma.client.usageMeter.findUnique({
      where: {
        organizationId_metricKey_periodKey: {
          organizationId,
          metricKey: 'ai_evaluations',
          periodKey: period,
        },
      },
    });
    const current = usage?.quantity ?? 0;
    if (current >= limits.maxAiEvaluationsPerMonth) {
      throw new ForbiddenException(
        `AI evaluation monthly quota reached (${current}/${limits.maxAiEvaluationsPerMonth}). Upgrade plan or wait for next period.`,
      );
    }
  }

  async assertWorkflowRunAllowed(organizationId: string): Promise<void> {
    const org = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const limits = entitlementsForPlan(org.planTier as PlanTier);
    const period = periodKey();
    const usage = await this.prisma.client.usageMeter.findUnique({
      where: {
        organizationId_metricKey_periodKey: {
          organizationId,
          metricKey: 'workflow_runs',
          periodKey: period,
        },
      },
    });
    const current = usage?.quantity ?? 0;
    if (current >= limits.maxWorkflowRunsPerMonth) {
      throw new ForbiddenException(
        `Workflow run monthly quota reached (${current}/${limits.maxWorkflowRunsPerMonth}).`,
      );
    }
  }

  async createAgencyClient(
    agencyOrgId: string,
    userId: string,
    input: { name: string },
  ) {
    const agency = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: agencyOrgId },
    });
    if (agency.segment !== 'agency' && agency.planTier !== 'agency' && agency.planTier !== 'enterprise') {
      throw new ForbiddenException('Only agency/enterprise tenants can create client organizations');
    }
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId: agencyOrgId, userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenException('Owner/admin required');
    }

    const limits = entitlementsForPlan(agency.planTier as PlanTier);
    const clientCount = await this.prisma.client.organization.count({
      where: { parentOrganizationId: agencyOrgId },
    });
    if (clientCount >= limits.maxClientOrgs) {
      throw new ForbiddenException(
        `Client organization quota reached (${clientCount}/${limits.maxClientOrgs})`,
      );
    }

    let slug = slugifyOrganizationName(input.name);
    slug = `${slug}-client-${Date.now().toString(36)}`.slice(0, 64);

    const client = await this.prisma.client.organization.create({
      data: {
        name: input.name.trim(),
        slug,
        segment: 'smb',
        planTier: 'growth',
        deploymentMode: 'pooled',
        parentOrganizationId: agencyOrgId,
        onboardingStep: 'agency_client_created',
        onboardingComplete: false,
      },
    });

    await this.prisma.client.membership.create({
      data: {
        organizationId: client.id,
        userId,
        role: 'owner',
        workspacePersona: 'operator',
      },
    });

    await this.audit.write({
      action: 'saas.agency_client_create',
      resourceType: 'organization',
      resourceId: client.id,
      organizationId: agencyOrgId,
      actorUserId: userId,
      metadata: { clientOrgId: client.id, clientSlug: client.slug },
    });

    return {
      agencyOrgId,
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        parentOrganizationId: client.parentOrganizationId,
      },
      note: 'Client tenant isolated by organizationId. Never share credentials across clients.',
    };
  }

  async listAgencyClients(agencyOrgId: string, userId: string) {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId: agencyOrgId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member');
    const clients = await this.prisma.client.organization.findMany({
      where: { parentOrganizationId: agencyOrgId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        segment: c.segment,
        planTier: c.planTier,
      })),
    };
  }

  async controlTower(organizationId: string) {
    const [
      products,
      orders,
      pendingApprovals,
      listings,
      connectors,
      opportunities,
      operatorRuns,
      fulfillments,
    ] = await Promise.all([
      this.prisma.client.product.count({ where: { organizationId } }),
      this.prisma.client.customerOrder.findMany({
        where: { organizationId },
        take: 200,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.approval.count({
        where: { organizationId, status: 'pending' },
      }),
      this.prisma.client.listing.count({ where: { organizationId } }),
      this.prisma.client.connectorInstallation.findMany({ where: { organizationId } }),
      this.prisma.client.opportunity.findMany({
        where: { organizationId },
        take: 100,
      }),
      this.prisma.client.operatorRun.count({
        where: { organizationId, status: { in: ['awaiting_approval', 'failed', 'blocked'] } },
      }),
      this.prisma.client.fulfillment.findMany({
        where: { organizationId },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const revenueMinor = orders.reduce((s, o) => s + (o.totalMinor ?? 0), 0);
    const contributionProfitMinor = opportunities.reduce((s, o) => s + o.expectedProfitMinor, 0);
    const delayedOrders = fulfillments.filter((f) =>
      /delay|exception|hold/i.test(f.status ?? ''),
    ).length;
    const unhealthyConnectors = connectors.filter(
      (c) => c.status !== 'connected' && c.status !== 'not_configured',
    ).length;
    const fixtureConnectors = connectors.filter((c) => c.isFixture).length;

    return {
      tenantId: organizationId,
      revenueMinor,
      expectedContributionProfitMinor: contributionProfitMinor,
      orderCount: orders.length,
      productCount: products,
      listingCount: listings,
      pendingApprovals,
      aiIssues: operatorRuns,
      delayedOrders,
      connectorHealth: {
        total: connectors.length,
        unhealthy: unhealthyConnectors,
        fixtureLabeled: fixtureConnectors,
      },
      cash: {
        note: 'Cash-available requires payout integration; showing supplier cash commitment proxy',
        supplierObligationProxyMinor: opportunities.reduce(
          (s, o) => s + Math.max(0, o.expectedProfitMinor > 0 ? 0 : 0),
          0,
        ),
      },
      filtersSupported: [
        'tenant',
        'product',
        'supplier',
        'channel',
        'currency',
      ],
      note: 'Control tower aggregates org-scoped operational signals. Expand filters as entity hierarchy grows.',
    };
  }

  async productAtp(organizationId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: { offers: true },
    });
    if (!product) throw new BadRequestException('Product not found');
    const supplierAvailable = product.offers.reduce((s, o) => s + o.inventoryQuantity, 0);
    const atp = calculateAtp({
      onHand: product.inventoryQuantity,
      reserved: 0,
      inbound: 0,
      damaged: 0,
      returnsPending: 0,
      supplierAvailable,
      safetyStock: Math.min(10, Math.floor(product.inventoryQuantity * 0.1)),
      channelAllocatedElsewhere: 0,
    });
    return {
      productId: product.id,
      title: product.title,
      sourcePlatform: product.sourcePlatform,
      isFixture: product.sourcePlatform.startsWith('fixture'),
      atp,
    };
  }

  async customerIntelligenceFromOrders(organizationId: string) {
    const orders = await this.prisma.client.customerOrder.findMany({
      where: { organizationId },
      take: 200,
      orderBy: { placedAt: 'desc' },
    });

    // Group by source+externalId pattern as customer proxy when no dedicated customer table yet
    const byCustomer = new Map<
      string,
      Array<{
        orderId: string;
        revenueMinor: number;
        contributionProfitMinor: number;
        returned: boolean;
        orderedAt: string;
      }>
    >();

    for (const o of orders) {
      const key = `${o.sourcePlatform}:${o.externalId.split('-')[0] ?? o.externalId}`;
      const list = byCustomer.get(key) ?? [];
      list.push({
        orderId: o.id,
        revenueMinor: o.totalMinor,
        contributionProfitMinor: Math.round(o.totalMinor * 0.2),
        returned: o.status === 'refunded',
        orderedAt: o.placedAt.toISOString(),
      });
      byCustomer.set(key, list);
    }

    const profiles = [...byCustomer.entries()].map(([customerKey, facts]) =>
      analyzeCustomer({ customerKey, orders: facts, consentMarketing: false }),
    );

    return {
      profileCount: profiles.length,
      profiles: profiles.slice(0, 25),
      note: 'Derived from org orders (proxy keys). PII minimized; not exposed to AI tools by default.',
    };
  }

  async founderCockpit(organizationId: string) {
    const [products, orders, approvals, opportunities, listings] = await Promise.all([
      this.prisma.client.product.count({ where: { organizationId } }),
      this.prisma.client.customerOrder.count({ where: { organizationId } }),
      this.prisma.client.approval.count({
        where: { organizationId, status: 'pending' },
      }),
      this.prisma.client.opportunity.findMany({
        where: { organizationId },
        orderBy: { score: 'desc' },
        take: 5,
        include: { product: true },
      }),
      this.prisma.client.listing.count({
        where: { organizationId, status: { in: ['active', 'pending_approval', 'draft'] } },
      }),
    ]);

    const cashRequired = opportunities.reduce(
      (sum, o) => sum + Math.max(0, o.product.supplierCostMinor + o.product.shippingCostMinor),
      0,
    );
    const expectedProfit = opportunities.reduce((sum, o) => sum + o.expectedProfitMinor, 0);

    const now = new Date().toISOString();
    const fixtureTop = opportunities.filter((o) =>
      o.product.sourcePlatform.startsWith('fixture'),
    ).length;

    return {
      mode: 'founder',
      summary: {
        products,
        orders,
        pendingApprovals: approvals,
        listings,
        topOpportunityCashRequiredMinor: cashRequired,
        topOpportunityExpectedProfitMinor: expectedProfit,
      },
      topOpportunities: opportunities.map((o) => ({
        productId: o.productId,
        title: o.product.title,
        score: o.score,
        signal: o.currentSignal,
        expectedProfitMinor: o.expectedProfitMinor,
        expectedMarginBps: o.expectedMarginBps,
        isFixture: o.product.sourcePlatform.startsWith('fixture'),
        sourcePlatform: o.product.sourcePlatform,
        dataFreshnessAt: o.product.dataFreshnessAt?.toISOString?.() ?? null,
        evidence: {
          productId: o.productId,
          opportunityId: o.id,
          sourcePlatform: o.product.sourcePlatform,
        },
      })),
      urgentActions: [
        approvals > 0 ? `${approvals} approval(s) waiting` : null,
        products === 0 ? 'Import or connect products' : null,
        listings === 0 && products > 0 ? 'Draft a listing for a top opportunity' : null,
      ].filter(Boolean),
      note: 'Founder cockpit prioritizes what to sell, cash, and pending actions. Not a full P&L.',
      provenance: {
        counts: {
          origin: 'canonical_store',
          sourceLabel: 'Prisma counts (Product, CustomerOrder, Approval, Listing)',
          canonicalModel: 'Product|CustomerOrder|Approval|Listing',
          observedAt: now,
          isLiveOperational: true,
          confidence: 1,
          lineage: 'organization-scoped COUNT queries',
          simulationLabel: null,
        },
        topOpportunities: {
          origin: fixtureTop > 0 ? 'fixture' : 'derived_model',
          sourceLabel: 'Opportunity ordered by score',
          canonicalModel: 'Opportunity+Product',
          observedAt: now,
          isLiveOperational: true,
          confidence: 0.7,
          lineage: 'opportunity.score DESC take 5; expectedProfit from model not realized P&L',
          simulationLabel:
            fixtureTop > 0 ? 'TEST FIXTURE — includes fixture-sourced products' : null,
        },
      },
      simulationMode: process.env.TRADEOPS_SIMULATION_MODE === '1',
    };
  }

  async channelProfitability(organizationId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new BadRequestException('Product not found in organization');

    const base = {
      sellingPriceMinor: product.targetPriceMinor,
      supplierCostMinor: product.supplierCostMinor,
      shippingCostMinor: product.shippingCostMinor,
      currency: product.currency,
      advertisingAllocationMinor: product.adAllocationMinor,
      returnReserveMinor: product.returnReserveMinor,
    };

    // Modeled channel fees — NOT live fee APIs until connectors provide them
    const comparison = recommendBestChannel([
      {
        channelKey: 'shopify-direct',
        displayName: 'Shopify direct (modeled)',
        ...base,
        marketplaceFeeMinor: Math.round(product.targetPriceMinor * 0.02),
        paymentFeeMinor: product.paymentFeeMinor || Math.round(product.targetPriceMinor * 0.029),
        payoutDelayDays: 3,
        conversionScore: 55,
        competitionScore: 40,
        policyRiskScore: 15,
      },
      {
        channelKey: 'amazon',
        displayName: 'Amazon (modeled)',
        ...base,
        marketplaceFeeMinor: product.marketplaceFeeMinor || Math.round(product.targetPriceMinor * 0.15),
        paymentFeeMinor: Math.round(product.targetPriceMinor * 0.02),
        payoutDelayDays: 14,
        conversionScore: 70,
        competitionScore: 65,
        policyRiskScore: 25,
      },
      {
        channelKey: 'ebay',
        displayName: 'eBay (modeled)',
        ...base,
        marketplaceFeeMinor: Math.round(product.targetPriceMinor * 0.13),
        paymentFeeMinor: Math.round(product.targetPriceMinor * 0.03),
        payoutDelayDays: 7,
        conversionScore: 60,
        competitionScore: 50,
        policyRiskScore: 20,
      },
    ]);

    return {
      productId: product.id,
      title: product.title,
      ...comparison,
      disclaimer:
        'SIMULATION — modeled channel fee heuristics from product costs, not live Shopify/Amazon fee APIs. Connect channel connectors for live economics.',
      provenance: {
        origin: 'derived_model',
        sourceLabel: 'Modeled fee assumptions',
        isLiveOperational: false,
        simulationLabel: 'SIMULATION — modeled channel fees',
        lineage: 'recommendBestChannel() with static fee rates × Product costs',
      },
    };
  }

  async agenticReadiness(organizationId: string, productId?: string) {
    if (productId) {
      const product = await this.prisma.client.product.findFirst({
        where: { id: productId, organizationId },
      });
      if (!product) throw new BadRequestException('Product not found');
      const ids = await this.prisma.client.productIdentifier.findMany({
        where: { organizationId, productId: product.id },
      });
      const policy = await this.prisma.client.policyAssessment.findFirst({
        where: { organizationId, productId: product.id },
        orderBy: { assessedAt: 'desc' },
      });
      const freshHours =
        (Date.now() - product.dataFreshnessAt.getTime()) / (1000 * 60 * 60);
      const policyBlocked = policy?.outcome === 'blocked';
      return {
        scope: 'product',
        productId: product.id,
        result: scoreAgenticReadiness({
          hasStructuredTitle: product.title.length >= 8,
          hasDescription: product.description.length >= 20,
          hasGtinOrMpn: ids.some((i: { scheme: string }) =>
            ['gtin', 'upc', 'ean', 'mpn'].includes(i.scheme),
          ),
          inventoryFreshHours: freshHours,
          priceFreshHours: freshHours,
          hasReturnPolicyText: false,
          hasDeliveryEstimate: product.shippingCostMinor >= 0,
          hasImage: false,
          dataConfidence: product.dataConfidence,
          policyBlocked,
        }),
      };
    }

    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: 50,
    });
    if (products.length === 0) {
      return {
        scope: 'tenant',
        averageScore: 0,
        sampleSize: 0,
        note: 'No products to score.',
      };
    }
    let total = 0;
    for (const p of products) {
      const ids = await this.prisma.client.productIdentifier.findMany({
        where: { organizationId, productId: p.id },
        take: 20,
      });
      const freshHours = (Date.now() - p.dataFreshnessAt.getTime()) / (1000 * 60 * 60);
      const r = scoreAgenticReadiness({
        hasStructuredTitle: p.title.length >= 8,
        hasDescription: p.description.length >= 20,
        hasGtinOrMpn: ids.some((i: { scheme: string }) =>
          ['gtin', 'upc', 'ean', 'mpn'].includes(i.scheme),
        ),
        inventoryFreshHours: freshHours,
        priceFreshHours: freshHours,
        hasReturnPolicyText: false,
        hasDeliveryEstimate: true,
        hasImage: false,
        dataConfidence: p.dataConfidence,
        policyBlocked: false,
      });
      total += r.score;
    }
    return {
      scope: 'tenant',
      averageScore: Math.round(total / products.length),
      sampleSize: products.length,
      note: 'Tenant average of product agentic readiness. Not a live UCP/ACP connection claim.',
    };
  }
}
