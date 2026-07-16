/**
 * Full vertical-slice seed:
 * - Demo owner user + org
 * - Fixture connector installs (labeled FIXTURE)
 * - Fixture supplier catalog imported as canonical products
 * - Opportunity scores, forecasts, signals, policy assessments
 *
 * Login: founder@tradeops.local / TradeOps-Demo-2026!
 */
import { hashPassword } from '@tradeops/auth';
import {
  assessProductPolicy,
  calculateUnitEconomics,
  decideSignal,
  estimateMarketplaceFeeMinor,
  estimatePaymentFeeMinor,
  forecastDemand,
  scoreOpportunity,
} from '@tradeops/commerce-engine';
import { FIXTURE_SUPPLIER_CATALOG } from '@tradeops/connector-fixture-supplier';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function intelFor(offer: (typeof FIXTURE_SUPPLIER_CATALOG)[0], targetPriceMinor: number) {
  const marketplaceFeeMinor = estimateMarketplaceFeeMinor(targetPriceMinor);
  const paymentFeeMinor = estimatePaymentFeeMinor(targetPriceMinor);
  const adAllocationMinor = Math.round(targetPriceMinor * 0.06);
  const returnReserveMinor = Math.round(targetPriceMinor * 0.02);

  const unit = calculateUnitEconomics({
    sellingPriceMinor: targetPriceMinor,
    marketplaceFeeMinor,
    paymentFeeMinor,
    supplierCostMinor: offer.supplierCostMinor,
    shippingCostMinor: offer.shippingCostMinor,
    advertisingAllocationMinor: adAllocationMinor,
    returnReserveMinor,
    currency: offer.currency,
    units: 1,
  });

  const policy = assessProductPolicy({
    title: offer.title,
    description: offer.description,
    category: offer.category,
  });

  const reviewHealth = Math.round(
    Math.min(100, (offer.rating / 5) * 80 + Math.min(20, offer.reviewCount / 50)),
  );
  const demandPotential = Math.min(
    100,
    40 + Math.min(40, offer.reviewCount / 30) + (offer.rating >= 4.3 ? 15 : 0),
  );
  const trendMomentum = Math.min(100, 45 + (offer.inventoryQuantity > 100 ? 15 : 5));
  const netMarginPotential = Math.min(100, Math.max(0, unit.netMarginBps / 40));
  const supplierQuality = Math.min(100, 55 + Math.min(35, offer.dataConfidence * 40));
  const shippingReliability = offer.shippingCostMinor < 500 ? 75 : 60;
  const competition = Math.min(100, 35 + (offer.category.length % 20));
  const returnRisk = Math.min(100, 100 - reviewHealth + 10);
  const policyRisk =
    policy.outcome === 'blocked' ? 100 : policy.outcome === 'manual_review' ? 70 : 15;
  const capitalRequirement = Math.min(
    100,
    (offer.supplierCostMinor + offer.shippingCostMinor) / 40,
  );

  const scored = scoreOpportunity({
    demandPotential,
    trendMomentum,
    netMarginPotential,
    supplierQuality,
    shippingReliability,
    reviewHealth,
    competition,
    returnRisk,
    policyRisk,
    capitalRequirement,
    dataConfidence: offer.dataConfidence * 100,
    policyBlocked: policy.outcome === 'blocked',
  });

  const daily = Math.max(1, Math.round(offer.reviewCount / 90));
  const observations = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
    units: daily + (i % 3),
  }));
  const forecast7 = forecastDemand(observations, 7);
  const forecast14 = forecastDemand(observations, 14);
  const forecast30 = forecastDemand(observations, 30);

  const signal = decideSignal({
    opportunityScore: scored.score,
    policyOutcome: policy.outcome,
    netMarginBps: unit.netMarginBps,
    hasActiveListing: false,
    forecastConfidence: forecast14.confidence,
    dataConfidence: offer.dataConfidence,
  });

  return {
    marketplaceFeeMinor,
    paymentFeeMinor,
    adAllocationMinor,
    returnReserveMinor,
    unit,
    policy,
    scored,
    forecast7,
    forecast14,
    forecast30,
    signal,
    expectedProfitMinor: unit.contributionProfitMinor * forecast14.expectedUnits,
    demandScore: Math.round(demandPotential),
    trendScore: Math.round(trendMomentum),
    competitionScore: Math.round(competition),
    supplierReliability: Math.round(supplierQuality),
    shippingReliability: Math.round(shippingReliability),
    reviewHealth: Math.round(reviewHealth),
    returnRiskScore: Math.round(returnRisk),
    policyRiskScore: Math.round(policyRisk),
  };
}

async function main() {
  const email = 'founder@tradeops.local';
  const password = 'TradeOps-Demo-2026!';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, displayName: 'TradeOps Founder', passwordHash },
    update: { passwordHash, displayName: 'TradeOps Founder' },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-commerce' },
    create: { name: 'Demo Commerce Co', slug: 'demo-commerce' },
    update: { name: 'Demo Commerce Co' },
  });

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    create: { organizationId: org.id, userId: user.id, role: 'owner' },
    update: { role: 'owner' },
  });

  await prisma.connectorInstallation.upsert({
    where: {
      organizationId_providerKey: { organizationId: org.id, providerKey: 'fixture-supplier' },
    },
    create: {
      organizationId: org.id,
      providerKey: 'fixture-supplier',
      displayName: 'Fixture Supplier (DEV)',
      family: 'supplier',
      isFixture: true,
      status: 'connected',
      capabilities: ['searchProducts', 'readProduct', 'readInventory', 'quoteShipping'],
      lastHealthAt: new Date(),
    },
    update: { status: 'connected', isFixture: true, lastHealthAt: new Date() },
  });

  await prisma.connectorInstallation.upsert({
    where: {
      organizationId_providerKey: { organizationId: org.id, providerKey: 'fixture-marketplace' },
    },
    create: {
      organizationId: org.id,
      providerKey: 'fixture-marketplace',
      displayName: 'Fixture Marketplace (DEV)',
      family: 'marketplace',
      isFixture: true,
      status: 'connected',
      capabilities: ['createListing', 'readOrders', 'readFees'],
      lastHealthAt: new Date(),
    },
    update: { status: 'connected', isFixture: true, lastHealthAt: new Date() },
  });

  await prisma.salesChannel.upsert({
    where: {
      organizationId_providerKey: { organizationId: org.id, providerKey: 'fixture-marketplace' },
    },
    create: {
      organizationId: org.id,
      name: 'Fixture Marketplace',
      providerKey: 'fixture-marketplace',
      isFixture: true,
    },
    update: { isFixture: true },
  });

  let imported = 0;
  for (const offer of FIXTURE_SUPPLIER_CATALOG) {
    const targetPriceMinor = Math.round(offer.supplierCostMinor * 2.6 + offer.shippingCostMinor);
    const intel = intelFor(offer, targetPriceMinor);

    const supplier = await prisma.supplier.upsert({
      where: {
        organizationId_sourcePlatform_externalId: {
          organizationId: org.id,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.supplierExternalId,
        },
      },
      create: {
        organizationId: org.id,
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

    const product = await prisma.product.upsert({
      where: {
        organizationId_sourcePlatform_externalId: {
          organizationId: org.id,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.externalId,
        },
      },
      create: {
        organizationId: org.id,
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
        adAllocationMinor: intel.adAllocationMinor,
        returnReserveMinor: intel.returnReserveMinor,
        inventoryQuantity: offer.inventoryQuantity,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        dataConfidence: offer.dataConfidence,
        dataFreshnessAt: new Date(),
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
        dataFreshnessAt: new Date(),
      },
    });

    await prisma.supplierOffer.upsert({
      where: {
        organizationId_sourcePlatform_externalId: {
          organizationId: org.id,
          sourcePlatform: offer.sourcePlatform,
          externalId: offer.externalId,
        },
      },
      create: {
        organizationId: org.id,
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

    await prisma.opportunity.upsert({
      where: {
        organizationId_productId: { organizationId: org.id, productId: product.id },
      },
      create: {
        organizationId: org.id,
        productId: product.id,
        score: intel.scored.score,
        formulaVersion: intel.scored.formulaVersion,
        componentsJson: intel.scored.components,
        explanation: intel.scored.explanation,
        expectedProfitMinor: intel.expectedProfitMinor,
        expectedMarginBps: intel.unit.netMarginBps,
        demandScore: intel.demandScore,
        trendScore: intel.trendScore,
        competitionScore: intel.competitionScore,
        supplierReliability: intel.supplierReliability,
        shippingReliability: intel.shippingReliability,
        reviewHealth: intel.reviewHealth,
        returnRiskScore: intel.returnRiskScore,
        policyRiskScore: intel.policyRiskScore,
        forecastConfidence: intel.forecast14.confidence,
        currentSignal: intel.signal.signal,
      },
      update: {
        score: intel.scored.score,
        formulaVersion: intel.scored.formulaVersion,
        componentsJson: intel.scored.components,
        explanation: intel.scored.explanation,
        expectedProfitMinor: intel.expectedProfitMinor,
        expectedMarginBps: intel.unit.netMarginBps,
        demandScore: intel.demandScore,
        trendScore: intel.trendScore,
        competitionScore: intel.competitionScore,
        supplierReliability: intel.supplierReliability,
        shippingReliability: intel.shippingReliability,
        reviewHealth: intel.reviewHealth,
        returnRiskScore: intel.returnRiskScore,
        policyRiskScore: intel.policyRiskScore,
        forecastConfidence: intel.forecast14.confidence,
        currentSignal: intel.signal.signal,
        scoredAt: new Date(),
      },
    });

    await prisma.policyAssessment.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        outcome: intel.policy.outcome,
        reasonsJson: intel.policy.reasons,
        riskFlagsJson: intel.policy.riskFlags,
        failClosed: intel.policy.failClosed,
      },
    });

    for (const f of [intel.forecast7, intel.forecast14, intel.forecast30]) {
      await prisma.demandForecast.create({
        data: {
          organizationId: org.id,
          productId: product.id,
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

    await prisma.commerceSignal.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        signal: intel.signal.signal,
        rationale: intel.signal.rationale,
        confidence: intel.signal.confidence,
      },
    });

    await prisma.profitabilitySnapshot.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        currency: intel.unit.currency,
        revenueMinor: intel.unit.revenueMinor,
        contributionProfitMinor: intel.unit.contributionProfitMinor,
        netMarginBps: intel.unit.netMarginBps,
        cashRequiredMinor: intel.unit.cashRequiredBeforePayoutMinor,
        breakdownJson: intel.unit,
      },
    });

    imported += 1;
  }

  console.log('TradeOps seed complete.');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  org:      ${org.slug}`);
  console.log(`  products: ${imported} (fixture-supplier, scored)`);
  console.log('  Open http://localhost:3000 → /terminal (no login)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
