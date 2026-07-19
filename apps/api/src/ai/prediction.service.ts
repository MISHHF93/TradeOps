import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  batchPredict,
  defaultPredictionWeights,
  PREDICTION_ENGINE_FAMILY,
  predictProduct,
  predictionToCsvRow,
  trainPredictionModel,
  type DemandObservation,
  type PredictionModelWeights,
  type ProductPrediction,
  type ProductPredictionFeatures,
} from '@tradeops/commerce-engine';
import { rowsToCsv } from '@tradeops/ai-runtime';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { EventFabricService } from '../events/event-fabric.service';

function asWeights(json: unknown): PredictionModelWeights | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (typeof o.unitBias !== 'number') return null;
  return {
    unitBias: Number(o.unitBias),
    profitBiasPerUnitMinor: Number(o.profitBiasPerUnitMinor ?? 0),
    artifactConfidenceBoost: Number(o.artifactConfidenceBoost ?? 0.08),
    sampleSize: Number(o.sampleSize ?? 0),
    trainedAt: String(o.trainedAt ?? new Date().toISOString()),
    modelVersion: String(o.modelVersion ?? 'prediction-engine-v1'),
  };
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventFabricService,
  ) {}

  private repoRoot(): string {
    const cwd = process.cwd();
    if (existsSync(join(cwd, 'pnpm-workspace.yaml'))) return cwd;
    const parent = join(cwd, '..', '..');
    if (existsSync(join(parent, 'pnpm-workspace.yaml'))) return parent;
    return cwd;
  }

  async status(organizationId: string) {
    const outcomes = await this.prisma.client.predictionOutcome.count({
      where: { organizationId },
    });
    const model = await this.prisma.client.modelVersion.findFirst({
      where: {
        family: PREDICTION_ENGINE_FAMILY,
        OR: [{ organizationId }, { organizationId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
    const forecasts = await this.prisma.client.demandForecast.count({
      where: { organizationId },
    });
    return {
      family: PREDICTION_ENGINE_FAMILY,
      outcomeSampleSize: outcomes,
      demandForecastCount: forecasts,
      activeModel: model
        ? {
            version: model.version,
            status: model.status,
            metrics: model.metricsJson,
            createdAt: model.createdAt.toISOString(),
          }
        : null,
      weights: model ? asWeights(model.metricsJson) : defaultPredictionWeights(),
      honesty: {
        note: 'Transparent baselines + outcome bias fit. Not a neural demand model. Empty history → low confidence.',
      },
    };
  }

  private async loadWeights(
    organizationId: string,
  ): Promise<PredictionModelWeights> {
    const model = await this.prisma.client.modelVersion.findFirst({
      where: {
        family: PREDICTION_ENGINE_FAMILY,
        OR: [{ organizationId }, { organizationId: null }],
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    return asWeights(model?.metricsJson) ?? defaultPredictionWeights();
  }

  async train(organizationId: string) {
    const outcomes = await this.prisma.client.predictionOutcome.findMany({
      where: { organizationId },
      take: 500,
      orderBy: { evaluatedAt: 'desc' },
    });

    const sims = await this.prisma.client.simulationRun.findMany({
      where: {
        organizationId,
        actualUnits: { not: null },
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    const samples = [
      ...outcomes.map((o) => ({
        predictedUnits: o.predictedUnits,
        actualUnits: o.actualUnits,
        predictedProfitMinor: o.predictedProfitMinor,
        actualProfitMinor: o.actualProfitMinor,
        signalCorrect: o.signalCorrect ?? undefined,
      })),
      ...sims
        .filter((s) => s.actualUnits != null && s.actualProfitMinor != null)
        .map((s) => ({
          predictedUnits: s.predictedUnits,
          actualUnits: s.actualUnits!,
          predictedProfitMinor: s.predictedProfitMinor,
          actualProfitMinor: s.actualProfitMinor!,
          signalCorrect: undefined as boolean | undefined,
        })),
    ];

    const { weights, evaluation } = trainPredictionModel(samples);

    const model = await this.prisma.client.modelVersion.create({
      data: {
        organizationId,
        version: weights.modelVersion,
        family: PREDICTION_ENGINE_FAMILY,
        status: 'active',
        metricsJson: {
          ...weights,
          evaluation,
        } as object,
        notes: evaluation.recommendation,
      },
    });

    await this.events.ingest({
      organizationId,
      eventType: 'ai.prediction.trained',
      providerKey: 'tradeops-prediction',
      externalEventId: `pred-train-${organizationId}-${Date.now()}`,
      isFixture: false,
      payload: {
        modelId: model.id,
        version: weights.modelVersion,
        sampleSize: samples.length,
        evaluation,
      },
    });

    return {
      modelId: model.id,
      weights,
      evaluation,
      sampleSize: samples.length,
      honesty: {
        note:
          samples.length === 0
            ? 'No outcomes yet — default weights saved. Run simulations or fulfill orders to improve.'
            : 'Weights fit from PredictionOutcome/SimulationRun actuals. Transparent unit/profit bias only.',
      },
    };
  }

  private async featuresForProduct(
    organizationId: string,
    productId: string,
  ): Promise<ProductPredictionFeatures> {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        opportunities: { take: 1, orderBy: { score: 'desc' } },
        listings: { take: 5 },
        artifacts: {
          take: 50,
          select: { publicationStatus: true, purpose: true },
        },
        policyAssessments: { take: 1, orderBy: { assessedAt: 'desc' } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const observations: DemandObservation[] = [];

    // Prefer order lines for this product
    try {
      const lines = await this.prisma.client.customerOrderLine.findMany({
        where: { organizationId, productId },
        include: { order: { select: { placedAt: true } } },
        take: 200,
      });
      const byDay = new Map<string, number>();
      for (const line of lines) {
        const d = line.order.placedAt.toISOString().slice(0, 10);
        byDay.set(d, (byDay.get(d) ?? 0) + line.quantity);
      }
      for (const [date, units] of [...byDay.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        observations.push({ date, units });
      }
    } catch (e) {
      this.logger.debug(
        `order lines: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (observations.length === 0) {
      const sims = await this.prisma.client.simulationRun.findMany({
        where: { organizationId, productId },
        take: 14,
        orderBy: { createdAt: 'asc' },
      });
      for (const s of sims) {
        observations.push({
          date: s.createdAt.toISOString().slice(0, 10),
          units: s.actualUnits ?? Math.max(1, Math.round(s.simulatedUnits / 14)),
        });
      }
    }

    const readyArtifacts = product.artifacts.filter(
      (a) =>
        a.publicationStatus === 'ready' ||
        a.publicationStatus === 'published',
    ).length;
    const artifactReadiness = Math.min(
      1,
      readyArtifacts / Math.max(3, product.artifacts.length || 3),
    );

    const opp = product.opportunities[0];
    const policy = product.policyAssessments[0];
    const policyOutcome =
      (policy?.outcome as ProductPredictionFeatures['policyOutcome']) ??
      'approved';

    return {
      productId: product.id,
      title: product.title,
      sellingPriceMinor: product.targetPriceMinor,
      marketplaceFeeMinor: product.marketplaceFeeMinor,
      paymentFeeMinor: product.paymentFeeMinor,
      supplierCostMinor: product.supplierCostMinor,
      shippingCostMinor: product.shippingCostMinor,
      advertisingAllocationMinor: product.adAllocationMinor,
      returnReserveMinor: product.returnReserveMinor,
      currency: product.currency,
      opportunityScore: opp?.score ?? 50,
      policyOutcome,
      netMarginBps: opp?.expectedMarginBps ?? 0,
      hasActiveListing: product.listings.some((l) => l.status === 'active'),
      dataConfidence: product.dataConfidence,
      artifactReadiness,
      observations,
      isFixture: product.sourcePlatform.startsWith('fixture'),
      sourcePlatform: product.sourcePlatform,
    };
  }

  async run(
    organizationId: string,
    input?: {
      productId?: string;
      horizonDays?: 7 | 14 | 30;
      limit?: number;
    },
  ) {
    const weights = await this.loadWeights(organizationId);
    const horizon = input?.horizonDays ?? 14;
    const predictions: ProductPrediction[] = [];

    if (input?.productId) {
      const f = await this.featuresForProduct(organizationId, input.productId);
      predictions.push(predictProduct(f, horizon, weights));
    } else {
      const opps = await this.prisma.client.opportunity.findMany({
        where: { organizationId },
        orderBy: { score: 'desc' },
        take: Math.min(input?.limit ?? 25, 50),
      });
      const features: ProductPredictionFeatures[] = [];
      for (const o of opps) {
        try {
          features.push(
            await this.featuresForProduct(organizationId, o.productId),
          );
        } catch {
          // skip missing
        }
      }
      predictions.push(...batchPredict(features, horizon, weights));
    }

    let written = 0;
    for (const p of predictions) {
      await this.prisma.client.demandForecast.create({
        data: {
          organizationId,
          productId: p.productId,
          horizonDays: p.horizonDays,
          expectedUnits: p.expectedUnits,
          lowUnits: p.lowUnits,
          highUnits: p.highUnits,
          confidence: p.confidence,
          modelVersion: p.modelVersion,
          factorsJson: p.factors,
          missingJson: p.missingSignals,
          explanation: p.explanation.slice(0, 4000),
        },
      });
      written += 1;
    }

    await this.events.ingest({
      organizationId,
      eventType: 'ai.prediction.run',
      providerKey: 'tradeops-prediction',
      externalEventId: `pred-run-${organizationId}-${Date.now()}`,
      isFixture: predictions.some((p) => p.isFixture),
      payload: {
        count: predictions.length,
        written,
        modelVersion: weights.modelVersion,
      },
    });

    return {
      count: predictions.length,
      written,
      modelVersion: weights.modelVersion,
      predictions,
      honesty: {
        note: 'Predictions use order-line/simulation history when present. Zero units with low confidence means missing history — not fabricated demand.',
      },
    };
  }

  async evaluate(organizationId: string) {
    const outcomes = await this.prisma.client.predictionOutcome.findMany({
      where: { organizationId },
      take: 500,
    });
    const samples = outcomes.map((o) => ({
      predictedUnits: o.predictedUnits,
      actualUnits: o.actualUnits,
      predictedProfitMinor: o.predictedProfitMinor,
      actualProfitMinor: o.actualProfitMinor,
      signalCorrect: o.signalCorrect ?? undefined,
    }));
    const { evaluation, weights } = trainPredictionModel(samples);
    return {
      evaluation,
      weightsPreview: weights,
      sampleSize: samples.length,
    };
  }

  async exportCsv(organizationId: string) {
    const run = await this.run(organizationId, { limit: 50 });
    const headers = [
      'productId',
      'title',
      'horizonDays',
      'expectedUnits',
      'lowUnits',
      'highUnits',
      'expectedContributionProfitMinor',
      'signal',
      'confidence',
      'modelVersion',
      'isFixture',
      'generatedAt',
    ];
    const rows = run.predictions.map((p) => predictionToCsvRow(p));
    const csv = rowsToCsv(headers, rows);
    const outPath = join(this.repoRoot(), 'predictions.csv');
    writeFileSync(outPath, csv, 'utf8');
    return {
      path: outPath,
      fileName: 'predictions.csv',
      rowCount: rows.length,
      modelVersion: run.modelVersion,
    };
  }
}
