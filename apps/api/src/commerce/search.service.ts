import { Injectable } from '@nestjs/common';
import {
  executeInternalSearch,
  planSearch,
  type SearchResponse,
} from '@tradeops/commerce-engine';
import { listFabricConnectors } from '@tradeops/connector-core';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unified Search Layer host — loads tenant data and runs orchestration.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(organizationId: string, query: string): Promise<SearchResponse> {
    const plan = planSearch(query);
    const started = Date.now();

    const [products, cases, orders, connectors, aiRuns] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { organizationId },
        take: 100,
        select: {
          id: true,
          title: true,
          category: true,
          sourcePlatform: true,
          dataConfidence: true,
          dataFreshnessAt: true,
          primaryImageUrl: true,
        },
      }),
      this.prisma.client.commerceCase.findMany({
        where: { organizationId, currentStage: { not: 'closed' } },
        take: 80,
        include: {
          product: { select: { title: true, primaryImageUrl: true } },
        },
      }),
      this.prisma.client.customerOrder.findMany({
        where: { organizationId },
        take: 50,
        select: {
          id: true,
          status: true,
          externalId: true,
          totalMinor: true,
          currency: true,
        },
      }),
      this.prisma.client.connectorInstallation.findMany({
        where: { organizationId },
        take: 60,
        select: { providerKey: true, status: true, isFixture: true },
      }),
      this.prisma.client.operatorRun.findMany({
        where: { organizationId },
        take: 30,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          objective: true,
          status: true,
          completedAt: true,
        },
      }),
    ]);

    const fabric = listFabricConnectors();
    const fabricNames = new Map(fabric.map((f) => [f.providerKey, f.displayName]));

    return executeInternalSearch(
      plan,
      {
        products,
        cases: cases.map((c) => ({
          id: c.id,
          productId: c.productId,
          productTitle: c.product?.title,
          currentStage: c.currentStage,
          stageStatus: c.stageStatus,
          opportunityScore: c.opportunityScore,
          primaryImageUrl: c.product?.primaryImageUrl ?? null,
        })),
        orders,
        connectors: connectors.map((c) => ({
          providerKey: c.providerKey,
          status: String(c.status),
          isFixture: c.isFixture || c.providerKey.startsWith('fixture'),
          displayName: fabricNames.get(c.providerKey) ?? c.providerKey,
        })),
        aiRuns,
      },
      started,
    );
  }
}
