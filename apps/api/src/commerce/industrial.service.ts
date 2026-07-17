import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildDigitalTwin,
  evaluateProcurementCase,
  industrialProfileFromProduct,
  listIndustrialRoles,
  listIndustrialVerticals,
  scoreIndustrialCompleteness,
  twinNeighborhood,
  type IndustrialProductProfile,
  type SupplierQuoteLine,
  type TechnicalRequirement,
} from '@tradeops/commerce-engine';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IndustrialService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return {
      verticals: listIndustrialVerticals(),
      roles: listIndustrialRoles(),
      honesty: {
        note: 'Industrial OS generalizes the same Product/Supplier/PO models — not a separate codebase.',
      },
    };
  }

  async listIndustrialProducts(organizationId: string, take = 50) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: Math.min(take, 100),
      orderBy: { updatedAt: 'desc' },
    });
    return {
      items: products.map((p) => {
        const profile = industrialProfileFromProduct(p);
        const completeness = scoreIndustrialCompleteness(profile);
        return {
          productId: p.id,
          title: p.title,
          category: p.category,
          manufacturer: profile.manufacturer ?? p.manufacturer,
          oemPartNumber: profile.oemPartNumber,
          mpn: profile.manufacturerPartNumber,
          sku: profile.sku ?? p.externalId,
          inventoryQuantity: p.inventoryQuantity,
          commerceMode: profile.commerceMode,
          verticals: profile.verticals,
          completeness,
          isFixture: p.sourcePlatform.startsWith('fixture'),
          profile,
        };
      }),
      honesty: {
        note: 'Industrial fields live in attributesJson.industrial + product columns. Fixture rows labeled.',
      },
    };
  }

  async getIndustrialProduct(organizationId: string, productId: string) {
    const p = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        offers: { include: { supplier: true }, take: 20 },
        artifacts: { take: 30 },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    const profile = industrialProfileFromProduct(p);
    // Enrich docs from artifacts
    const docs = p.artifacts.map((a) => ({
      kind: mapArtifactPurposeToDoc(String(a.purpose)),
      title: a.title ?? String(a.artifactType),
      artifactId: a.id,
    }));
    const enriched: IndustrialProductProfile = {
      ...profile,
      documents: [...(profile.documents ?? []), ...docs],
      supplierAvailability: p.offers.map((o) => ({
        supplierName: o.supplier?.name ?? o.sourcePlatform,
        unitCostMinor: o.costMinor,
        leadTimeDays: undefined,
      })),
    };
    return {
      productId: p.id,
      title: p.title,
      profile: enriched,
      completeness: scoreIndustrialCompleteness(enriched),
      offers: p.offers.map((o) => ({
        supplierId: o.supplierId,
        supplierName: o.supplier?.name,
        costMinor: o.costMinor,
        shippingMinor: o.shippingCostMinor,
      })),
      isFixture: p.sourcePlatform.startsWith('fixture'),
    };
  }

  async upsertIndustrialProfile(
    organizationId: string,
    productId: string,
    industrial: Partial<IndustrialProductProfile>,
  ) {
    const p = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!p) throw new NotFoundException('Product not found');
    const prev =
      p.attributesJson && typeof p.attributesJson === 'object'
        ? (p.attributesJson as Record<string, unknown>)
        : {};
    const current = industrialProfileFromProduct(p);
    const next = { ...current, ...industrial, schemaVersion: 'industrial-v1' as const };
    await this.prisma.client.product.update({
      where: { id: p.id },
      data: {
        attributesJson: { ...prev, industrial: next } as object,
        manufacturer: next.manufacturer ?? p.manufacturer,
        brand: next.brand ?? p.brand,
        countryOfOrigin: next.countryOfOrigin ?? p.countryOfOrigin,
      },
    });
    return { productId, profile: next, completeness: scoreIndustrialCompleteness(next) };
  }

  async evaluateProcurement(
    organizationId: string,
    input: {
      productId: string;
      requirements?: TechnicalRequirement[];
      quotes?: SupplierQuoteLine[];
      quantity?: number;
    },
  ) {
    const detail = await this.getIndustrialProduct(organizationId, input.productId);
    const quotes: SupplierQuoteLine[] =
      input.quotes ??
      detail.offers.map((o) => ({
        supplierName: o.supplierName ?? 'supplier',
        supplierId: o.supplierId,
        unitCostMinor: o.costMinor,
        currency: detail.profile.currency ?? 'USD',
        shippingMinor: o.shippingMinor,
        moq: detail.profile.moq,
        leadTimeDays: detail.profile.leadTimeDays,
      }));

    const others = await this.prisma.client.product.findMany({
      where: { organizationId, id: { not: input.productId } },
      take: 30,
    });

    return evaluateProcurementCase({
      productId: detail.productId,
      title: detail.title,
      profile: detail.profile,
      requirements: input.requirements ?? [],
      quotes,
      quantity: input.quantity ?? detail.profile.moq ?? 1,
      substitutes: others.map((p) => ({
        productId: p.id,
        title: p.title,
        profile: industrialProfileFromProduct(p),
      })),
    });
  }

  async digitalTwin(organizationId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: 100,
    });
    const suppliers = await this.prisma.client.supplier.findMany({
      where: { organizationId },
      take: 50,
    });
    const offers = await this.prisma.client.supplierOffer.findMany({
      where: { organizationId },
      take: 200,
      select: { productId: true, supplierId: true },
    });
    const pos = await this.prisma.client.supplierPurchaseOrder.findMany({
      where: { organizationId },
      take: 50,
    });
    const orders = await this.prisma.client.customerOrder.findMany({
      where: { organizationId },
      take: 50,
    });
    const artifacts = await this.prisma.client.productArtifact.findMany({
      where: { organizationId },
      take: 100,
      select: { id: true, productId: true, title: true },
    });

    const twin = buildDigitalTwin({
      organizationId,
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        sourcePlatform: p.sourcePlatform,
        inventoryQuantity: p.inventoryQuantity,
        manufacturer: p.manufacturer,
      })),
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        sourcePlatform: s.sourcePlatform,
      })),
      offers: offers
        .filter((o) => Boolean(o.productId && o.supplierId))
        .map((o) => ({
          productId: o.productId as string,
          supplierId: o.supplierId,
        })),
      purchaseOrders: pos.map((po) => ({
        id: po.id,
        productId: po.productId,
        status: String(po.status),
      })),
      orders: orders.map((o) => ({
        id: o.id,
        status: String(o.status),
        externalId: o.externalId,
      })),
      artifacts,
    });

    return twin;
  }

  async twinFocus(organizationId: string, nodeId: string) {
    const twin = await this.digitalTwin(organizationId);
    return {
      ...twinNeighborhood(twin, nodeId, 2),
      honesty: twin.honesty,
    };
  }
}

function mapArtifactPurposeToDoc(
  purpose: string,
): 'sds' | 'cad' | 'manual' | 'install_guide' | 'warranty' | 'certificate' | 'drawing' | 'other' {
  if (purpose === 'manual') return 'manual';
  if (purpose === 'warranty') return 'warranty';
  if (purpose === 'compliance' || purpose === 'regulatory') return 'certificate';
  if (purpose === 'installation') return 'install_guide';
  if (purpose === 'specification') return 'drawing';
  return 'other';
}
