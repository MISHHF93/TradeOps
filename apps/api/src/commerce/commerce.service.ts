import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FixtureMarketplaceConnector } from '@tradeops/connector-fixture-marketplace';
import { FixtureSupplierConnector } from '@tradeops/connector-fixture-supplier';
import {
  calculateUnitEconomics,
  evaluatePredictions,
  PIPELINE_STAGES,
  realizedContributionProfitMinor,
  type PipelineStageState,
} from '@tradeops/commerce-engine';
type CommerceSignalType =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'SCALE'
  | 'REDUCE'
  | 'EXIT'
  | 'BLOCKED';
type PolicyOutcome = 'approved' | 'approved_with_conditions' | 'manual_review' | 'blocked';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import { CommercePaymentService } from '../billing/commerce-payment.service';
import { ArtifactService } from './artifact.service';
import { deriveProductIntelligence } from './commerce.scoring';

@Injectable()
export class CommerceService {
  private readonly supplier = new FixtureSupplierConnector();
  private readonly marketplace = new FixtureMarketplaceConnector();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly artifacts: ArtifactService,
    private readonly commercePayments: CommercePaymentService,
  ) {}

  async ensureFixtureConnectors(organizationId: string) {
    await this.prisma.client.connectorInstallation.upsert({
      where: {
        organizationId_providerKey: { organizationId, providerKey: 'fixture-supplier' },
      },
      create: {
        organizationId,
        providerKey: 'fixture-supplier',
        displayName: 'Fixture Supplier (DEV)',
        family: 'supplier',
        isFixture: true,
        status: 'connected',
        capabilities: this.supplier.manifest.capabilities,
        lastHealthAt: new Date(),
      },
      update: {
        status: 'connected',
        lastHealthAt: new Date(),
        isFixture: true,
      },
    });

    await this.prisma.client.connectorInstallation.upsert({
      where: {
        organizationId_providerKey: { organizationId, providerKey: 'fixture-marketplace' },
      },
      create: {
        organizationId,
        providerKey: 'fixture-marketplace',
        displayName: 'Fixture Marketplace (DEV)',
        family: 'marketplace',
        isFixture: true,
        status: 'connected',
        capabilities: this.marketplace.manifest.capabilities,
        lastHealthAt: new Date(),
      },
      update: {
        status: 'connected',
        lastHealthAt: new Date(),
        isFixture: true,
      },
    });

    await this.prisma.client.salesChannel.upsert({
      where: {
        organizationId_providerKey: { organizationId, providerKey: 'fixture-marketplace' },
      },
      create: {
        organizationId,
        name: 'Fixture Marketplace',
        providerKey: 'fixture-marketplace',
        isFixture: true,
      },
      update: { name: 'Fixture Marketplace', isFixture: true },
    });
  }

  async importFromFixtureSupplier(organizationId: string, userId: string) {
    await this.ensureFixtureConnectors(organizationId);
    const offers = await this.supplier.searchProducts('');
    let imported = 0;

    for (const offer of offers) {
      const supplier = await this.prisma.client.supplier.upsert({
        where: {
          organizationId_sourcePlatform_externalId: {
            organizationId,
            sourcePlatform: offer.sourcePlatform,
            externalId: offer.supplierExternalId,
          },
        },
        create: {
          organizationId,
          name: offer.supplierName,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.supplierExternalId,
          reliabilityScore: 78,
          dataConfidence: offer.dataConfidence,
          collectedAt: new Date(offer.collectedAt),
        },
        update: {
          name: offer.supplierName,
          dataConfidence: offer.dataConfidence,
          collectedAt: new Date(offer.collectedAt),
        },
      });

      const targetPriceMinor = Math.round(offer.supplierCostMinor * 2.6 + offer.shippingCostMinor);
      const intel = deriveProductIntelligence({
        title: offer.title,
        description: offer.description,
        category: offer.category,
        supplierCostMinor: offer.supplierCostMinor,
        shippingCostMinor: offer.shippingCostMinor,
        targetPriceMinor,
        adAllocationMinor: Math.round(targetPriceMinor * 0.06),
        returnReserveMinor: Math.round(targetPriceMinor * 0.02),
        currency: offer.currency,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        inventoryQuantity: offer.inventoryQuantity,
        dataConfidence: offer.dataConfidence,
        hasActiveListing: false,
      });

      const primaryImage =
        offer.imageUrl ??
        offer.imageUrls?.[0] ??
        offer.media?.find((m) => m.kind === 'image')?.url ??
        null;
      const gallery =
        offer.imageUrls?.length
          ? offer.imageUrls
          : (offer.media ?? [])
              .filter((m) => m.kind === 'image')
              .map((m) => m.url);
      const mediaPayload = offer.media ?? [];
      const attributes = {
        ...(offer.attributes ?? {}),
        brand: offer.brand ?? offer.attributes?.brand,
        manufacturer: offer.manufacturer ?? offer.attributes?.manufacturer,
      };

      const product = await this.prisma.client.product.upsert({
        where: {
          organizationId_sourcePlatform_externalId: {
            organizationId,
            sourcePlatform: offer.sourcePlatform,
            externalId: offer.externalId,
          },
        },
        create: {
          organizationId,
          title: offer.title,
          description: offer.description,
          category: offer.category,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.externalId,
          currency: offer.currency,
          supplierCostMinor: offer.supplierCostMinor,
          shippingCostMinor: offer.shippingCostMinor,
          targetPriceMinor,
          marketplaceFeeMinor: intel.marketplaceFeeMinor,
          paymentFeeMinor: intel.paymentFeeMinor,
          adAllocationMinor: Math.round(targetPriceMinor * 0.06),
          returnReserveMinor: Math.round(targetPriceMinor * 0.02),
          inventoryQuantity: offer.inventoryQuantity,
          rating: offer.rating,
          reviewCount: offer.reviewCount,
          dataConfidence: offer.dataConfidence,
          dataFreshnessAt: new Date(offer.collectedAt),
          brand: offer.brand ?? null,
          manufacturer: offer.manufacturer ?? null,
          condition:
            typeof offer.attributes?.condition === 'string'
              ? offer.attributes.condition
              : 'new',
          countryOfOrigin:
            typeof offer.attributes?.countryOfOrigin === 'string'
              ? offer.attributes.countryOfOrigin
              : null,
          primaryImageUrl: primaryImage,
          galleryImageUrlsJson: gallery as object,
          mediaJson: mediaPayload as object,
          attributesJson: attributes as object,
          mediaCount: mediaPayload.length || gallery.length,
          schemaVersion: '2',
          sourceProvenance: `${offer.sourcePlatform}:${offer.externalId}`,
        },
        update: {
          title: offer.title,
          description: offer.description,
          supplierCostMinor: offer.supplierCostMinor,
          shippingCostMinor: offer.shippingCostMinor,
          targetPriceMinor,
          marketplaceFeeMinor: intel.marketplaceFeeMinor,
          paymentFeeMinor: intel.paymentFeeMinor,
          inventoryQuantity: offer.inventoryQuantity,
          rating: offer.rating,
          reviewCount: offer.reviewCount,
          dataConfidence: offer.dataConfidence,
          dataFreshnessAt: new Date(offer.collectedAt),
          brand: offer.brand ?? null,
          manufacturer: offer.manufacturer ?? null,
          primaryImageUrl: primaryImage,
          galleryImageUrlsJson: gallery as object,
          mediaJson: mediaPayload as object,
          attributesJson: attributes as object,
          mediaCount: mediaPayload.length || gallery.length,
          schemaVersion: '2',
          sourceProvenance: `${offer.sourcePlatform}:${offer.externalId}`,
        },
      });

      await this.prisma.client.supplierOffer.upsert({
        where: {
          organizationId_sourcePlatform_externalId: {
            organizationId,
            sourcePlatform: offer.sourcePlatform,
            externalId: offer.externalId,
          },
        },
        create: {
          organizationId,
          supplierId: supplier.id,
          productId: product.id,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.externalId,
          title: offer.title,
          costMinor: offer.supplierCostMinor,
          shippingCostMinor: offer.shippingCostMinor,
          currency: offer.currency,
          inventoryQuantity: offer.inventoryQuantity,
          dataConfidence: offer.dataConfidence,
          collectedAt: new Date(offer.collectedAt),
        },
        update: {
          productId: product.id,
          costMinor: offer.supplierCostMinor,
          shippingCostMinor: offer.shippingCostMinor,
          inventoryQuantity: offer.inventoryQuantity,
        },
      });

      await this.persistIntelligence(organizationId, product.id, intel, false);

      // Materialize digital twin media: local stubs + discover source image URLs
      try {
        await this.artifacts.bootstrapFromProductSources(organizationId, product.id, userId);
        // Best-effort remote ingest of primary/gallery (SSRF-safe); failures leave local stubs
        for (const m of mediaPayload.filter((x) => x.kind === 'image').slice(0, 4)) {
          try {
            await this.artifacts.ingestRemoteUrl({
              organizationId,
              productId: product.id,
              url: m.url,
              purpose: m.purpose === 'primary' ? 'primary' : 'gallery',
              title: m.title ?? offer.title,
              userId,
            });
          } catch {
            // Network / SSRF / host policy — keep local generated media
          }
        }
      } catch {
        // Bootstrap optional on import — product row still has media JSON
      }

      imported += 1;
    }

    await this.audit.write({
      action: 'commerce.import_fixture_supplier',
      resourceType: 'connector',
      resourceId: 'fixture-supplier',
      organizationId,
      actorUserId: userId,
      metadata: { imported },
    });

    return { imported, provider: 'fixture-supplier', isFixture: true };
  }

  private async persistIntelligence(
    organizationId: string,
    productId: string,
    intel: ReturnType<typeof deriveProductIntelligence>,
    hasActiveListing: boolean,
  ) {
    const recomputed = hasActiveListing
      ? null
      : intel;

    const data = recomputed ?? intel;

    await this.prisma.client.opportunity.upsert({
      where: { organizationId_productId: { organizationId, productId } },
      create: {
        organizationId,
        productId,
        score: data.scored.score,
        formulaVersion: data.scored.formulaVersion,
        componentsJson: data.scored.components,
        explanation: data.scored.explanation,
        expectedProfitMinor: data.expectedProfitMinor,
        expectedMarginBps: data.unit.netMarginBps,
        demandScore: data.demandScore,
        trendScore: data.trendScore,
        competitionScore: data.competitionScore,
        supplierReliability: data.supplierReliability,
        shippingReliability: data.shippingReliability,
        reviewHealth: data.reviewHealth,
        returnRiskScore: data.returnRiskScore,
        policyRiskScore: data.policyRiskScore,
        forecastConfidence: data.forecast14.confidence,
        currentSignal: data.signal as CommerceSignalType,
      },
      update: {
        score: data.scored.score,
        formulaVersion: data.scored.formulaVersion,
        componentsJson: data.scored.components,
        explanation: data.scored.explanation,
        expectedProfitMinor: data.expectedProfitMinor,
        expectedMarginBps: data.unit.netMarginBps,
        demandScore: data.demandScore,
        trendScore: data.trendScore,
        competitionScore: data.competitionScore,
        supplierReliability: data.supplierReliability,
        shippingReliability: data.shippingReliability,
        reviewHealth: data.reviewHealth,
        returnRiskScore: data.returnRiskScore,
        policyRiskScore: data.policyRiskScore,
        forecastConfidence: data.forecast14.confidence,
        currentSignal: data.signal as CommerceSignalType,
        scoredAt: new Date(),
      },
    });

    await this.prisma.client.policyAssessment.create({
      data: {
        organizationId,
        productId,
        outcome: data.policy.outcome as PolicyOutcome,
        reasonsJson: data.policy.reasons,
        riskFlagsJson: data.policy.riskFlags,
        failClosed: data.policy.failClosed,
      },
    });

    for (const f of [data.forecast7, data.forecast14, data.forecast30]) {
      await this.prisma.client.demandForecast.create({
        data: {
          organizationId,
          productId,
          horizonDays: f.horizonDays,
          expectedUnits: f.expectedUnits,
          lowUnits: f.lowUnits,
          highUnits: f.highUnits,
          confidence: f.confidence,
          modelVersion: f.modelVersion,
          factorsJson: f.factors,
          missingJson: f.missingSignals,
          explanation: f.explanation,
        },
      });
    }

    await this.prisma.client.commerceSignal.create({
      data: {
        organizationId,
        productId,
        signal: data.signal as CommerceSignalType,
        rationale: data.signalRationale,
        confidence: data.signalConfidence,
      },
    });

    await this.prisma.client.profitabilitySnapshot.create({
      data: {
        organizationId,
        productId,
        currency: data.unit.currency,
        revenueMinor: data.unit.revenueMinor,
        contributionProfitMinor: data.unit.contributionProfitMinor,
        netMarginBps: data.unit.netMarginBps,
        cashRequiredMinor: data.unit.cashRequiredBeforePayoutMinor,
        breakdownJson: data.unit,
      },
    });
  }

  async rescoreProduct(organizationId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: { listings: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const hasActiveListing = product.listings.some((l) => l.status === 'active');
    const intel = deriveProductIntelligence({
      title: product.title,
      description: product.description,
      category: product.category,
      supplierCostMinor: product.supplierCostMinor,
      shippingCostMinor: product.shippingCostMinor,
      targetPriceMinor: product.targetPriceMinor,
      marketplaceFeeMinor: product.marketplaceFeeMinor,
      paymentFeeMinor: product.paymentFeeMinor,
      adAllocationMinor: product.adAllocationMinor,
      returnReserveMinor: product.returnReserveMinor,
      currency: product.currency,
      rating: product.rating,
      reviewCount: product.reviewCount,
      inventoryQuantity: product.inventoryQuantity,
      dataConfidence: product.dataConfidence,
      hasActiveListing,
    });
    await this.persistIntelligence(organizationId, productId, intel, hasActiveListing);
    return intel;
  }

  async scanner(organizationId: string) {
    const rows = await this.prisma.client.opportunity.findMany({
      where: { organizationId },
      include: {
        product: {
          include: {
            offers: { include: { supplier: true }, take: 1 },
            listings: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    return rows.map((o) => {
      const p = o.product;
      const supplier = p.offers[0]?.supplier;
      return {
        productId: p.id,
        product: p.title,
        description: p.description,
        category: p.category,
        brand: p.brand,
        sourcePlatform: p.sourcePlatform,
        supplier: supplier?.name ?? 'Unknown',
        supplierCostMinor: p.supplierCostMinor,
        shippingCostMinor: p.shippingCostMinor,
        estimatedMarketplaceFeesMinor: p.marketplaceFeeMinor,
        estimatedAdvertisingAllowanceMinor: p.adAllocationMinor,
        targetSellingPriceMinor: p.targetPriceMinor,
        expectedNetProfitMinor: o.expectedProfitMinor,
        expectedMarginBps: o.expectedMarginBps,
        demandScore: o.demandScore,
        trendScore: o.trendScore,
        competitionScore: o.competitionScore,
        supplierReliability: o.supplierReliability,
        shippingReliability: o.shippingReliability,
        reviewHealth: o.reviewHealth,
        returnRiskScore: o.returnRiskScore,
        policyRiskScore: o.policyRiskScore,
        forecastConfidence: o.forecastConfidence,
        currentSignal: o.currentSignal,
        lastDataUpdate: p.dataFreshnessAt.toISOString(),
        currency: p.currency,
        score: o.score,
        hasActiveListing: p.listings.some((l) => l.status === 'active'),
        rating: p.rating,
        reviewCount: p.reviewCount,
        primaryImageUrl: p.primaryImageUrl,
        mediaCount: p.mediaCount,
        galleryImageUrls: Array.isArray(p.galleryImageUrlsJson)
          ? p.galleryImageUrlsJson
          : [],
      };
    });
  }

  async productDetail(organizationId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        offers: { include: { supplier: true } },
        listings: { include: { salesChannel: true } },
        opportunities: true,
        signals: { orderBy: { createdAt: 'desc' }, take: 20 },
        forecasts: { orderBy: { generatedAt: 'desc' }, take: 6 },
        policyAssessments: { orderBy: { assessedAt: 'desc' }, take: 3 },
        profitabilitySnapshots: { orderBy: { createdAt: 'desc' }, take: 3 },
        simulationRuns: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async signalFeed(organizationId: string) {
    return this.prisma.client.commerceSignal.findMany({
      where: { organizationId },
      include: { product: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async portfolio(organizationId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      include: { listings: true, opportunities: true },
    });
    const orders = await this.prisma.client.customerOrder.findMany({ where: { organizationId } });
    const pos = await this.prisma.client.supplierPurchaseOrder.findMany({
      where: { organizationId },
    });

    const activeListings = products.filter((p) => p.listings.some((l) => l.status === 'active'));
    const capitalCommitted = pos
      .filter((p) => p.isDraft || p.status === 'pending' || p.status === 'paid')
      .reduce((s, p) => s + p.costMinor + p.shippingMinor, 0);
    const revenue = orders.reduce((s, o) => s + o.totalMinor, 0);

    let contribution = 0;
    for (const p of products) {
      const opp = p.opportunities[0];
      if (opp) {
        contribution += opp.expectedProfitMinor;
      }
    }

    const fixtureCount = products.filter((p) =>
      p.sourcePlatform.startsWith('fixture'),
    ).length;
    const liveProductCount = products.length - fixtureCount;

    // Channel concentration from actual listing/channel data — never hardcode fixture
    const channelKeys = activeListings.flatMap((p) =>
      p.listings
        .filter((l) => l.status === 'active')
        .map((l) => p.sourcePlatform),
    );
    const marketplaceConcentration = this.concentration(
      channelKeys.length ? channelKeys : [],
    );

    // Pending payouts: only when CommercePayout rows exist — never invent % of revenue
    let pendingPayouts: number | null = null;
    let payoutProvenanceOrigin: 'canonical_store' | 'unavailable' = 'unavailable';
    try {
      const payouts = await this.prisma.client.commercePayout.findMany({
        where: {
          organizationId,
          status: { in: ['pending', 'in_transit'] },
        },
        take: 200,
      });
      if (payouts.length > 0) {
        pendingPayouts = payouts.reduce((s, p) => s + p.netAmountMinor, 0);
        payoutProvenanceOrigin = 'canonical_store';
      }
    } catch {
      pendingPayouts = null;
    }

    const now = new Date().toISOString();
    return {
      activeProducts: activeListings.length,
      totalProducts: products.length,
      capitalCommittedMinor: capitalCommitted,
      outstandingSupplierPaymentsMinor: capitalCommitted,
      /** null when no payout connector data — UI must show empty state, not fabricate */
      pendingMarketplacePayoutsMinor: pendingPayouts,
      revenueMinor: revenue,
      grossProfitEstimateMinor: contribution,
      netProfitEstimateMinor: contribution,
      advertisingSpendMinor: products.reduce((s, p) => s + p.adAllocationMinor, 0),
      refundExposureMinor: products.reduce((s, p) => s + p.returnReserveMinor, 0),
      supplierConcentration: this.concentration(
        products.map((p) => p.sourcePlatform),
      ),
      marketplaceConcentration,
      categoryConcentration: this.concentration(products.map((p) => p.category)),
      currency: products[0]?.currency ?? 'USD',
      dataClass: {
        fixtureProducts: fixtureCount,
        liveOrCanonicalProducts: liveProductCount,
        simulationMode: process.env.TRADEOPS_SIMULATION_MODE === '1',
      },
      provenance: {
        revenue: {
          origin: 'canonical_store',
          sourceLabel: 'CustomerOrder.totalMinor sum',
          canonicalModel: 'CustomerOrder',
          observedAt: now,
          syncStatus: orders.length ? 'fresh' : 'never',
          confidence: 1,
          lineage: 'sum(customer_orders.total_minor) for organization',
          isLiveOperational: true,
          simulationLabel: null,
        },
        expectedContribution: {
          origin: 'derived_model',
          sourceLabel: 'Opportunity.expectedProfitMinor',
          canonicalModel: 'Opportunity',
          observedAt: now,
          syncStatus: 'fresh',
          confidence: 0.6,
          lineage: 'sum of opportunity model estimates — not realized P&L',
          isLiveOperational: true,
          simulationLabel: fixtureCount > 0 ? 'Includes TEST FIXTURE products' : null,
        },
        pendingPayouts: {
          origin: payoutProvenanceOrigin,
          sourceLabel:
            payoutProvenanceOrigin === 'canonical_store'
              ? 'CommercePayout pending sum'
              : 'No payout rows — connect payment connector',
          sourceConnector: 'stripe-api / marketplace payouts',
          canonicalModel: 'CommercePayout',
          observedAt: now,
          syncStatus: payoutProvenanceOrigin === 'canonical_store' ? 'fresh' : 'not_connected',
          confidence: payoutProvenanceOrigin === 'canonical_store' ? 0.9 : 0,
          lineage: 'Never derived as percentage of revenue',
          isLiveOperational: payoutProvenanceOrigin === 'canonical_store',
          simulationLabel: null,
          refreshHint: 'Sync payouts from payment connector or leave unavailable',
        },
        advertisingAllocation: {
          origin: 'canonical_store',
          sourceLabel: 'Product.adAllocationMinor planning reserve',
          canonicalModel: 'Product',
          observedAt: now,
          syncStatus: 'fresh',
          confidence: 0.5,
          lineage: 'Planning allocation on product — not live Google/Meta spend',
          isLiveOperational: false,
          simulationLabel: 'PLANNING — not live ad platform spend',
        },
      },
    };
  }

  private concentration(keys: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const k of keys) {
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }

  async createListingDraft(organizationId: string, userId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: { policyAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const policy = product.policyAssessments[0];
    if (policy?.outcome === 'blocked') {
      throw new ForbiddenException('Product is BLOCKED by policy — cannot create listing draft');
    }

    const channel = await this.prisma.client.salesChannel.findFirst({
      where: { organizationId, providerKey: 'fixture-marketplace' },
    });
    if (!channel) {
      throw new BadRequestException('Fixture marketplace channel missing — run import first');
    }

    // Channel media selection from Product Artifact Engine (references, not file copies)
    const mediaPlan = await this.artifacts.listingMediaPlan(
      organizationId,
      productId,
      'fixture_marketplace',
    );

    const draft = await this.marketplace.createListingDraft({
      title: product.title,
      priceMinor: product.targetPriceMinor,
      currency: product.currency,
      sku: product.externalId,
    });

    // Draft only — status draft. Publish requires separate approval (not created here).
    let listing = await this.prisma.client.listing.findFirst({
      where: {
        organizationId,
        productId: product.id,
        salesChannelId: channel.id,
        status: { in: ['draft', 'pending_approval'] },
      },
    });

    if (listing) {
      listing = await this.prisma.client.listing.update({
        where: { id: listing.id },
        data: {
          status: 'draft',
          externalId: draft.externalId ?? listing.externalId,
          priceMinor: product.targetPriceMinor,
        },
      });
    } else {
      listing = await this.prisma.client.listing.create({
        data: {
          organizationId,
          productId: product.id,
          salesChannelId: channel.id,
          status: 'draft',
          externalId: draft.externalId,
          priceMinor: product.targetPriceMinor,
          currency: product.currency,
          sku: product.externalId,
        },
      });
    }

    await this.audit.write({
      action: 'listing.draft_created',
      resourceType: 'listing',
      resourceId: listing.id,
      organizationId,
      actorUserId: userId,
      metadata: {
        note: 'Draft only — publish requires requestPublishListing + approval',
        selectedArtifactIds: mediaPlan.selectedArtifactIds,
        mediaBlocked: mediaPlan.blocked,
      },
    });

    return {
      listing,
      approval: null,
      mediaPlan: {
        selectedArtifactIds: mediaPlan.selectedArtifactIds,
        blocked: mediaPlan.blocked,
        channelReadiness: mediaPlan.channelReadiness,
        note: mediaPlan.note,
      },
      note: 'Listing draft created with channel media references. External publish requires separate approval and rights validation.',
    };
  }

  /**
   * Request publish of an existing draft — creates idempotent pending publish_listing approval.
   */
  async requestPublishListing(organizationId: string, userId: string, listingId: string) {
    const listing = await this.prisma.client.listing.findFirst({
      where: { id: listingId, organizationId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status === 'active') {
      throw new BadRequestException('Listing already active');
    }

    const existing = await this.prisma.client.approval.findFirst({
      where: {
        organizationId,
        listingId: listing.id,
        kind: 'publish_listing',
        status: { in: ['pending', 'approved'] },
      },
    });
    if (existing) {
      return { listing, approval: existing, deduped: true };
    }

    await this.prisma.client.listing.update({
      where: { id: listing.id },
      data: { status: 'pending_approval' },
    });

    const approval = await this.prisma.client.approval.create({
      data: {
        organizationId,
        kind: 'publish_listing',
        status: 'pending',
        listingId: listing.id,
        requestedByUserId: userId,
        note: 'Human approval required before marketplace publish',
      },
    });

    await this.audit.write({
      action: 'listing.publish_requested',
      resourceType: 'approval',
      resourceId: approval.id,
      organizationId,
      actorUserId: userId,
    });

    return { listing, approval, deduped: false };
  }

  async decideApproval(
    organizationId: string,
    userId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
  ) {
    const approval = await this.prisma.client.approval.findFirst({
      where: { id: approvalId, organizationId },
      include: { listing: true, supplierPurchaseOrder: true },
    });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    const updated = await this.prisma.client.approval.update({
      where: { id: approvalId },
      data: { status: decision, decidedAt: new Date() },
    });

    if (decision === 'approved' && approval.kind === 'publish_listing' && approval.listing) {
      if (approval.listing.externalId) {
        await this.marketplace.publishListing(approval.listing.externalId);
      }
      await this.prisma.client.listing.update({
        where: { id: approval.listing.id },
        data: { status: 'active' },
      });
      await this.rescoreProduct(organizationId, approval.listing.productId);
    }

    if (decision === 'approved' && approval.kind === 'supplier_purchase_order' && approval.supplierPurchaseOrder) {
      const po = approval.supplierPurchaseOrder;
      // Re-verify payment at approval time — status may have changed since draft PO creation
      if (po.customerOrderId) {
        await this.commercePayments.assertOrderPaymentReady(organizationId, po.customerOrderId);
      }
      await this.prisma.client.supplierPurchaseOrder.update({
        where: { id: po.id },
        data: { isDraft: false, status: 'paid' },
      });
      // Advance fulfillment when supplier PO is approved (procurement authorized).
      if (po.customerOrderId) {
        await this.prisma.client.fulfillment.updateMany({
          where: { customerOrderId: po.customerOrderId, organizationId },
          data: {
            status: 'in_transit',
            carrier: 'fixture-carrier',
            trackingNumber: `FX-${Date.now().toString(36).toUpperCase()}`,
          },
        });
      }
    }

    if (decision === 'rejected' && approval.listing) {
      await this.prisma.client.listing.update({
        where: { id: approval.listing.id },
        data: { status: 'rejected' },
      });
    }

    await this.audit.write({
      action: `approval.${decision}`,
      resourceType: 'approval',
      resourceId: approvalId,
      organizationId,
      actorUserId: userId,
    });

    return updated;
  }

  async listApprovals(organizationId: string) {
    return this.prisma.client.approval.findMany({
      where: { organizationId },
      include: { listing: true, supplierPurchaseOrder: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runSimulation(organizationId: string, userId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: { opportunities: true, forecasts: { orderBy: { generatedAt: 'desc' }, take: 1 } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const unit = calculateUnitEconomics({
      sellingPriceMinor: product.targetPriceMinor,
      marketplaceFeeMinor: product.marketplaceFeeMinor,
      paymentFeeMinor: product.paymentFeeMinor,
      supplierCostMinor: product.supplierCostMinor,
      shippingCostMinor: product.shippingCostMinor,
      advertisingAllocationMinor: product.adAllocationMinor,
      returnReserveMinor: product.returnReserveMinor,
      currency: product.currency,
      units: 1,
    });

    const predictedUnits = product.forecasts[0]?.expectedUnits ?? 10;
    const simulatedUnits = Math.max(1, Math.round(predictedUnits * 0.9));
    const predictedProfit = unit.contributionProfitMinor * predictedUnits;
    // Paper outcome: slight noise around prediction for tracking
    const actualUnits = Math.max(0, simulatedUnits + (simulatedUnits % 3) - 1);
    const actualProfit = unit.contributionProfitMinor * actualUnits;

    const run = await this.prisma.client.simulationRun.create({
      data: {
        organizationId,
        productId,
        signal: product.opportunities[0]?.currentSignal ?? 'HOLD',
        simulatedUnits,
        predictedProfitMinor: predictedProfit,
        actualProfitMinor: actualProfit,
        predictedUnits,
        actualUnits,
        assumptionsJson: {
          mode: 'commerce_simulation',
          unitEconomics: unit,
          note: 'Paper trading only — no real money or customer orders placed',
        },
      },
    });

    await this.audit.write({
      action: 'simulation.run',
      resourceType: 'product',
      resourceId: productId,
      organizationId,
      actorUserId: userId,
      metadata: { simulationRunId: run.id },
    });

    return run;
  }

  async ingestFixtureOrders(organizationId: string, userId: string) {
    const orders = await this.marketplace.listOpenOrders();
    const created = [];

    for (const order of orders) {
      const product = await this.prisma.client.product.findFirst({
        where: {
          organizationId,
          externalId: order.lines[0]?.externalSku,
        },
      });

      const row = await this.prisma.client.customerOrder.upsert({
        where: {
          organizationId_sourcePlatform_externalId: {
            organizationId,
            sourcePlatform: order.sourcePlatform,
            externalId: order.externalId,
          },
        },
        create: {
          organizationId,
          sourcePlatform: order.sourcePlatform,
          externalId: order.externalId,
          status: 'paid',
          currency: order.currency,
          totalMinor: order.totalMinor,
          placedAt: new Date(order.placedAt),
          lines: {
            create: order.lines.map((l) => ({
              organizationId,
              productId: product?.id,
              title: l.title,
              sku: l.externalSku,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
            })),
          },
        },
        update: {
          status: 'paid',
          totalMinor: order.totalMinor,
        },
        include: { lines: true },
      });

      // Commerce payment intelligence (channel/shopper money — not SaaS billing)
      await this.commercePayments.ensurePaymentForOrder({
        organizationId,
        orderId: row.id,
        channel: order.sourcePlatform,
        totalMinor: order.totalMinor,
        currency: order.currency,
        isFixture: true,
      });

      if (product) {
        // Gate sourcing on verified payment state (never PO only because order exists)
        await this.commercePayments.assertOrderPaymentReady(organizationId, row.id);

        const po = await this.prisma.client.supplierPurchaseOrder.create({
          data: {
            organizationId,
            productId: product.id,
            customerOrderId: row.id,
            status: 'pending',
            costMinor: product.supplierCostMinor * (order.lines[0]?.quantity ?? 1),
            shippingMinor: product.shippingCostMinor * (order.lines[0]?.quantity ?? 1),
            currency: product.currency,
            quantity: order.lines[0]?.quantity ?? 1,
            isDraft: true,
          },
        });

        await this.prisma.client.approval.create({
          data: {
            organizationId,
            kind: 'supplier_purchase_order',
            status: 'pending',
            supplierPurchaseOrderId: po.id,
            requestedByUserId: userId,
            note: 'Approve supplier purchase order draft before execution (payment verified)',
          },
        });

        await this.prisma.client.fulfillment.create({
          data: {
            organizationId,
            customerOrderId: row.id,
            status: 'awaiting_supplier',
            carrier: null,
            trackingNumber: null,
          },
        });
      }

      created.push(row);
    }

    await this.audit.write({
      action: 'orders.ingest_fixture',
      resourceType: 'customer_order',
      organizationId,
      actorUserId: userId,
      metadata: { count: created.length },
    });

    return { ingested: created.length, orders: created };
  }

  async listConnectors(organizationId: string) {
    // Avoid double upsert on every page load (was ~10s on PGlite).
    const existing = await this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      orderBy: { providerKey: 'asc' },
    });
    if (existing.length >= 2) {
      return existing;
    }
    await this.ensureFixtureConnectors(organizationId);
    return this.prisma.client.connectorInstallation.findMany({
      where: { organizationId },
      orderBy: { providerKey: 'asc' },
    });
  }

  async listOrders(organizationId: string) {
    return this.prisma.client.customerOrder.findMany({
      where: { organizationId },
      include: { lines: true, fulfillments: true, purchaseOrders: true },
      orderBy: { placedAt: 'desc' },
    });
  }

  /**
   * Live status of the full commerce pipeline for the org.
   * One SQL round-trip (11 separate counts were very slow on PGlite + connection_limit=1).
   */
  async getPipelineStatus(organizationId: string): Promise<{
    stages: PipelineStageState[];
    modelVersion: string;
  }> {
    type Counts = {
      products: number;
      opportunities: number;
      simulations: number;
      pending_approvals: number;
      active_listings: number;
      orders: number;
      pos: number;
      fulfillments: number;
      delivered: number;
      outcomes: number;
      connectors: number;
    };

    const rows = await this.prisma.client.$queryRawUnsafe<Counts[]>(
      `SELECT
        (SELECT COUNT(*)::int FROM products WHERE organization_id = $1::uuid) AS products,
        (SELECT COUNT(*)::int FROM opportunities WHERE organization_id = $1::uuid) AS opportunities,
        (SELECT COUNT(*)::int FROM simulation_runs WHERE organization_id = $1::uuid) AS simulations,
        (SELECT COUNT(*)::int FROM approvals WHERE organization_id = $1::uuid AND status = 'pending') AS pending_approvals,
        (SELECT COUNT(*)::int FROM listings WHERE organization_id = $1::uuid AND status = 'active') AS active_listings,
        (SELECT COUNT(*)::int FROM customer_orders WHERE organization_id = $1::uuid) AS orders,
        (SELECT COUNT(*)::int FROM supplier_purchase_orders WHERE organization_id = $1::uuid) AS pos,
        (SELECT COUNT(*)::int FROM fulfillments WHERE organization_id = $1::uuid) AS fulfillments,
        (SELECT COUNT(*)::int FROM fulfillments WHERE organization_id = $1::uuid AND status IN ('delivered','fulfilled')) AS delivered,
        (SELECT COUNT(*)::int FROM prediction_outcomes WHERE organization_id = $1::uuid) AS outcomes,
        (SELECT COUNT(*)::int FROM connector_installations WHERE organization_id = $1::uuid AND status = 'connected') AS connectors`,
      organizationId,
    );
    const c = rows[0] ?? {
      products: 0,
      opportunities: 0,
      simulations: 0,
      pending_approvals: 0,
      active_listings: 0,
      orders: 0,
      pos: 0,
      fulfillments: 0,
      delivered: 0,
      outcomes: 0,
      connectors: 0,
    };

    const products = Number(c.products);
    const opportunities = Number(c.opportunities);
    const simulations = Number(c.simulations);
    const pendingApprovals = Number(c.pending_approvals);
    const activeListings = Number(c.active_listings);
    const orders = Number(c.orders);
    const pos = Number(c.pos);
    const fulfillments = Number(c.fulfillments);
    const delivered = Number(c.delivered);
    const outcomes = Number(c.outcomes);
    const connectors = Number(c.connectors);

    const stage = (
      id: (typeof PIPELINE_STAGES)[number]['id'],
      status: PipelineStageState['status'],
      count: number,
      detail?: string,
    ): PipelineStageState => {
      const meta = PIPELINE_STAGES.find((s) => s.id === id)!;
      return { id, title: meta.title, description: meta.description, status, count, detail };
    };

    const stages: PipelineStageState[] = [
      stage(
        'market_data',
        connectors > 0 ? 'complete' : 'not_started',
        connectors,
        connectors ? `${connectors} connector(s) connected (may be FIXTURE)` : 'Import or connect sources',
      ),
      stage('normalize', products > 0 ? 'complete' : 'not_started', products),
      stage('forecast', opportunities > 0 ? 'complete' : 'not_started', opportunities),
      stage('signal', opportunities > 0 ? 'complete' : 'not_started', opportunities),
      stage('simulation', simulations > 0 ? 'complete' : products > 0 ? 'ready' : 'not_started', simulations),
      stage(
        'approval',
        pendingApprovals > 0 ? 'in_progress' : activeListings + pos > 0 ? 'complete' : 'ready',
        pendingApprovals,
        pendingApprovals ? `${pendingApprovals} pending human decision(s)` : undefined,
      ),
      stage('listing', activeListings > 0 ? 'complete' : 'ready', activeListings),
      stage('customer_order', orders > 0 ? 'complete' : 'ready', orders),
      stage('supplier_po', pos > 0 ? 'complete' : 'ready', pos),
      stage(
        'fulfillment',
        delivered > 0 ? 'complete' : fulfillments > 0 ? 'in_progress' : 'ready',
        fulfillments,
      ),
      stage('actual_profit', delivered > 0 || outcomes > 0 ? 'complete' : 'ready', delivered + outcomes),
      stage(
        'evaluation',
        outcomes > 0 ? 'complete' : simulations > 0 || delivered > 0 ? 'ready' : 'not_started',
        outcomes,
      ),
    ];

    return { stages, modelVersion: 'baseline-ma-v1' };
  }

  /**
   * Mark order fulfilled/delivered, compute realized profit, write PredictionOutcome.
   */
  async completeFulfillment(
    organizationId: string,
    userId: string,
    customerOrderId: string,
  ) {
    const order = await this.prisma.client.customerOrder.findFirst({
      where: { id: customerOrderId, organizationId },
      include: {
        lines: { include: { product: true } },
        fulfillments: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Customer order not found');
    }

    await this.prisma.client.customerOrder.update({
      where: { id: order.id },
      data: { status: 'fulfilled' },
    });

    await this.prisma.client.fulfillment.updateMany({
      where: { customerOrderId: order.id, organizationId },
      data: {
        status: 'delivered',
        carrier: order.fulfillments[0]?.carrier ?? 'fixture-carrier',
        trackingNumber:
          order.fulfillments[0]?.trackingNumber ?? `FX-DEL-${Date.now().toString(36).toUpperCase()}`,
      },
    });

    const outcomes = [];
    for (const line of order.lines) {
      const product = line.product;
      if (!product) continue;

      const actualProfit = realizedContributionProfitMinor({
        unitPriceMinor: line.unitPriceMinor,
        quantity: line.quantity,
        marketplaceFeeMinorPerUnit: product.marketplaceFeeMinor,
        paymentFeeMinorPerUnit: product.paymentFeeMinor,
        supplierCostMinorPerUnit: product.supplierCostMinor,
        shippingCostMinorPerUnit: product.shippingCostMinor,
        adAllocationMinorPerUnit: product.adAllocationMinor,
        returnReserveMinorPerUnit: product.returnReserveMinor,
      });

      const forecast = await this.prisma.client.demandForecast.findFirst({
        where: { organizationId, productId: product.id, horizonDays: 14 },
        orderBy: { generatedAt: 'desc' },
      });
      const opp = await this.prisma.client.opportunity.findUnique({
        where: { organizationId_productId: { organizationId, productId: product.id } },
      });

      const predictedUnits = forecast?.expectedUnits ?? line.quantity;
      const unit = calculateUnitEconomics({
        sellingPriceMinor: product.targetPriceMinor,
        marketplaceFeeMinor: product.marketplaceFeeMinor,
        paymentFeeMinor: product.paymentFeeMinor,
        supplierCostMinor: product.supplierCostMinor,
        shippingCostMinor: product.shippingCostMinor,
        advertisingAllocationMinor: product.adAllocationMinor,
        returnReserveMinor: product.returnReserveMinor,
        currency: product.currency,
        units: 1,
      });
      const predictedProfit = unit.contributionProfitMinor * predictedUnits;
      const signalCorrect =
        opp != null
          ? actualProfit > 0
            ? ['BUY', 'SELL', 'SCALE', 'HOLD'].includes(opp.currentSignal)
            : ['REDUCE', 'EXIT', 'BLOCKED', 'HOLD'].includes(opp.currentSignal)
          : null;

      const outcome = await this.prisma.client.predictionOutcome.create({
        data: {
          organizationId,
          productId: product.id,
          modelVersion: forecast?.modelVersion ?? 'baseline-ma-v1',
          source: 'fulfilled_order',
          predictedUnits,
          actualUnits: line.quantity,
          predictedProfitMinor: predictedProfit,
          actualProfitMinor: actualProfit,
          signalAtPrediction: opp?.currentSignal ?? null,
          signalCorrect,
          unitAbsoluteError: Math.abs(line.quantity - predictedUnits),
          profitAbsoluteError: Math.abs(actualProfit - predictedProfit),
          notes: `Order ${order.externalId} delivered`,
        },
      });
      outcomes.push(outcome);

      await this.prisma.client.profitabilitySnapshot.create({
        data: {
          organizationId,
          productId: product.id,
          currency: order.currency,
          revenueMinor: line.unitPriceMinor * line.quantity,
          contributionProfitMinor: actualProfit,
          netMarginBps:
            line.unitPriceMinor * line.quantity > 0
              ? Math.round((actualProfit / (line.unitPriceMinor * line.quantity)) * 10_000)
              : 0,
          cashRequiredMinor:
            (product.supplierCostMinor + product.shippingCostMinor) * line.quantity,
          breakdownJson: {
            kind: 'realized',
            orderId: order.id,
            lineId: line.id,
            actualProfitMinor: actualProfit,
          },
        },
      });
    }

    await this.audit.write({
      action: 'fulfillment.completed',
      resourceType: 'customer_order',
      resourceId: order.id,
      organizationId,
      actorUserId: userId,
      metadata: { outcomes: outcomes.length },
    });

    return { orderId: order.id, status: 'fulfilled', outcomes };
  }

  /**
   * Aggregate prediction evaluation and optionally record model version metrics.
   */
  async evaluateAndImprove(organizationId: string, userId: string) {
    const rows = await this.prisma.client.predictionOutcome.findMany({
      where: { organizationId },
      orderBy: { evaluatedAt: 'desc' },
      take: 500,
    });

    // Also fold recent simulation runs that have actuals
    const sims = await this.prisma.client.simulationRun.findMany({
      where: {
        organizationId,
        actualUnits: { not: null },
        actualProfitMinor: { not: null },
      },
      take: 200,
    });

    const samples = [
      ...rows.map((r) => ({
        predictedUnits: r.predictedUnits,
        actualUnits: r.actualUnits,
        predictedProfitMinor: r.predictedProfitMinor,
        actualProfitMinor: r.actualProfitMinor,
        signalCorrect: r.signalCorrect ?? undefined,
      })),
      ...sims.map((s) => ({
        predictedUnits: s.predictedUnits,
        actualUnits: s.actualUnits ?? 0,
        predictedProfitMinor: s.predictedProfitMinor,
        actualProfitMinor: s.actualProfitMinor ?? 0,
      })),
    ];

    const report = evaluatePredictions(samples, 'baseline-ma-v1');

    // Persist model version metrics for improvement trail
    await this.prisma.client.modelVersion.upsert({
      where: {
        organizationId_version_family: {
          organizationId,
          version: report.modelVersion,
          family: 'demand_profit',
        },
      },
      create: {
        organizationId,
        version: report.modelVersion,
        family: 'demand_profit',
        status: 'active',
        metricsJson: report,
        notes: report.recommendation,
      },
      update: {
        metricsJson: report,
        notes: report.recommendation,
        status: 'active',
      },
    });

    // Record evaluation snapshots from simulations that are not yet outcomes
    for (const s of sims.slice(0, 20)) {
      const exists = await this.prisma.client.predictionOutcome.findFirst({
        where: {
          organizationId,
          productId: s.productId,
          source: 'simulation',
          predictedUnits: s.predictedUnits,
          actualUnits: s.actualUnits ?? 0,
        },
      });
      if (!exists && s.actualUnits != null && s.actualProfitMinor != null) {
        await this.prisma.client.predictionOutcome.create({
          data: {
            organizationId,
            productId: s.productId,
            modelVersion: report.modelVersion,
            source: 'simulation',
            predictedUnits: s.predictedUnits,
            actualUnits: s.actualUnits,
            predictedProfitMinor: s.predictedProfitMinor,
            actualProfitMinor: s.actualProfitMinor,
            unitAbsoluteError: Math.abs(s.actualUnits - s.predictedUnits),
            profitAbsoluteError: Math.abs(s.actualProfitMinor - s.predictedProfitMinor),
            notes: 'Backfilled from simulation run',
          },
        });
      }
    }

    await this.audit.write({
      action: 'model.evaluate',
      resourceType: 'model_version',
      resourceId: report.modelVersion,
      organizationId,
      actorUserId: userId,
      metadata: { sampleSize: report.sampleSize },
    });

    return report;
  }

  async listPredictionOutcomes(organizationId: string) {
    return this.prisma.client.predictionOutcome.findMany({
      where: { organizationId },
      include: { product: { select: { id: true, title: true } } },
      orderBy: { evaluatedAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Local vertical-slice driver: seed-backed catalog → sim → listing → approvals →
   * fixture orders → PO approvals → fulfill → evaluate. Safe to re-run (idempotent-ish).
   */
  async runDemoLoop(organizationId: string, userId: string) {
    await this.ensureFixtureConnectors(organizationId);

    const productCount = await this.prisma.client.product.count({ where: { organizationId } });
    if (productCount === 0) {
      await this.importFromFixtureSupplier(organizationId, userId);
    }

    const rows = await this.scanner(organizationId);
    const pick =
      rows.find((r) => r.currentSignal === 'BUY') ||
      rows.find((r) => r.currentSignal !== 'BLOCKED') ||
      rows[0];
    if (!pick) {
      throw new BadRequestException('No products available for demo loop');
    }

    const simulation = await this.runSimulation(organizationId, userId, pick.productId);

    const activeListing = await this.prisma.client.listing.findFirst({
      where: { organizationId, productId: pick.productId, status: 'active' },
    });
    let listingDraft: Awaited<ReturnType<CommerceService['createListingDraft']>> | null = null;
    if (!activeListing) {
      const pendingListing = await this.prisma.client.listing.findFirst({
        where: { organizationId, productId: pick.productId, status: 'pending_approval' },
      });
      if (!pendingListing) {
        listingDraft = await this.createListingDraft(organizationId, userId, pick.productId);
      }
    }

    const approvePending = async () => {
      const pending = await this.prisma.client.approval.findMany({
        where: { organizationId, status: 'pending' },
      });
      const decided = [];
      for (const a of pending) {
        decided.push(await this.decideApproval(organizationId, userId, a.id, 'approved'));
      }
      return decided;
    };

    const publishApprovals = await approvePending();
    const ingest = await this.ingestFixtureOrders(organizationId, userId);
    const poApprovals = await approvePending();

    const orders = await this.prisma.client.customerOrder.findMany({
      where: { organizationId },
      orderBy: { placedAt: 'desc' },
    });
    const fulfillments = [];
    for (const o of orders) {
      if (o.status === 'fulfilled') continue;
      try {
        fulfillments.push(await this.completeFulfillment(organizationId, userId, o.id));
      } catch {
        // already fulfilled or missing lines — keep loop resilient
      }
    }

    const evaluation = await this.evaluateAndImprove(organizationId, userId);
    const pipeline = await this.getPipelineStatus(organizationId);

    await this.audit.write({
      action: 'terminal.demo_loop',
      resourceType: 'organization',
      resourceId: organizationId,
      organizationId,
      actorUserId: userId,
      metadata: {
        productId: pick.productId,
        orders: ingest.ingested,
        fulfillments: fulfillments.length,
      },
    });

    return {
      product: { id: pick.productId, title: pick.product, signal: pick.currentSignal, score: pick.score },
      simulationId: simulation.id,
      listingCreated: Boolean(listingDraft),
      approvalsDecided: publishApprovals.length + poApprovals.length,
      ordersIngested: ingest.ingested,
      fulfillmentsCompleted: fulfillments.length,
      evaluation,
      pipeline,
    };
  }

  async listWatchlist(organizationId: string) {
    const items = await this.prisma.client.productWatchlistItem.findMany({
      where: { organizationId },
      include: {
        product: {
          include: {
            opportunities: { take: 1, orderBy: { score: 'desc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: items.map((w) => ({
        id: w.id,
        productId: w.productId,
        note: w.note,
        createdAt: w.createdAt,
        title: w.product.title,
        category: w.product.category,
        sourcePlatform: w.product.sourcePlatform,
        isFixture: w.product.sourcePlatform.startsWith('fixture'),
        score: w.product.opportunities[0]?.score ?? null,
        signal: w.product.opportunities[0]?.currentSignal ?? null,
        targetPriceMinor: w.product.targetPriceMinor,
        currency: w.product.currency,
      })),
      note: 'Org-scoped watchlist. Not a live marketplace alert feed.',
    };
  }

  async addToWatchlist(
    organizationId: string,
    userId: string | null | undefined,
    productId: string,
    note?: string,
  ) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found in organization');

    const item = await this.prisma.client.productWatchlistItem.upsert({
      where: {
        organizationId_productId: { organizationId, productId },
      },
      create: {
        organizationId,
        productId,
        userId: userId ?? null,
        note: note?.slice(0, 500) ?? null,
      },
      update: {
        note: note?.slice(0, 500) ?? undefined,
        userId: userId ?? undefined,
      },
    });

    await this.audit.write({
      action: 'watchlist.add',
      resourceType: 'product',
      resourceId: productId,
      organizationId,
      actorUserId: userId ?? null,
      metadata: { watchlistItemId: item.id },
    });

    return { item, note: 'Added to org watchlist' };
  }

  async removeFromWatchlist(organizationId: string, productId: string, userId?: string | null) {
    const existing = await this.prisma.client.productWatchlistItem.findUnique({
      where: { organizationId_productId: { organizationId, productId } },
    });
    if (!existing) throw new NotFoundException('Not on watchlist');
    await this.prisma.client.productWatchlistItem.delete({ where: { id: existing.id } });
    await this.audit.write({
      action: 'watchlist.remove',
      resourceType: 'product',
      resourceId: productId,
      organizationId,
      actorUserId: userId ?? null,
      metadata: {},
    });
    return { removed: true, productId };
  }
}
