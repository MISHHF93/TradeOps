import { Injectable } from '@nestjs/common';
import {
  resolveIdentities,
  type ProductIdentityInput,
} from '@tradeops/harmonization';
import { PrismaService } from '../prisma/prisma.service';

function asJson(value: unknown): object {
  return value as object;
}

@Injectable()
export class HarmonizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOrganizationProducts(organizationId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      include: { identifiers: true },
      take: 200,
    });

    const inputs: ProductIdentityInput[] = products.map((p) => ({
      productId: p.id,
      title: p.title,
      brand: p.brand,
      sourcePlatform: p.sourcePlatform,
      externalId: p.externalId,
      category: p.category,
      identifiers: p.identifiers.map((id) => ({
        scheme: id.scheme,
        value: id.value,
        confidence: id.confidence,
      })),
    }));

    // Seed identifiers from externalId when none exist (low confidence)
    for (const p of products) {
      if (p.identifiers.length === 0) {
        await this.prisma.client.productIdentifier.upsert({
          where: {
            organizationId_scheme_value_sourcePlatform: {
              organizationId,
              scheme: 'external_id',
              value: p.externalId,
              sourcePlatform: p.sourcePlatform,
            },
          },
          create: {
            organizationId,
            productId: p.id,
            scheme: 'external_id',
            value: p.externalId,
            sourcePlatform: p.sourcePlatform,
            confidence: 0.5,
          },
          update: { productId: p.id },
        });
      }
    }

    const matches = resolveIdentities(inputs);
    const persisted = [];

    for (const m of matches) {
      const link = await this.prisma.client.identityLink.upsert({
        where: {
          organizationId_sourceProductId_targetProductId: {
            organizationId,
            sourceProductId: m.sourceProductId,
            targetProductId: m.targetProductId,
          },
        },
        create: {
          organizationId,
          sourceProductId: m.sourceProductId,
          targetProductId: m.targetProductId,
          matchMethod: m.matchMethod,
          confidence: m.confidence,
          evidenceJson: asJson(m.evidence),
          status: m.autoLinkEligible ? 'auto_linked' : 'proposed',
        },
        update: {
          matchMethod: m.matchMethod,
          confidence: m.confidence,
          evidenceJson: asJson(m.evidence),
          status: m.autoLinkEligible ? 'auto_linked' : 'proposed',
        },
      });
      persisted.push(link);
    }

    return {
      productCount: products.length,
      matchCount: matches.length,
      autoLinked: matches.filter((m) => m.autoLinkEligible).length,
      proposedOnly: matches.filter((m) => !m.autoLinkEligible).length,
      matches: matches.map((m) => ({
        ...m,
        note: m.autoLinkEligible
          ? 'High-confidence identifier match — eligible for auto-link'
          : 'Proposed only — title/similarity must not force merge',
      })),
      links: persisted,
    };
  }

  async storeExternalPayload(input: {
    organizationId: string;
    productId?: string;
    providerKey: string;
    externalId: string;
    payloadKind: string;
    raw: Record<string, unknown>;
  }) {
    return this.prisma.client.externalPayload.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId ?? null,
        providerKey: input.providerKey,
        externalId: input.externalId,
        payloadKind: input.payloadKind,
        rawJson: asJson(input.raw),
      },
    });
  }
}
