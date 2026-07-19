import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildDigitalTwin,
  evaluateProcurementCase,
  industrialProfileFromProduct,
  listIndustrialRoles,
  listIndustrialVerticals,
  matchRequirements,
  parseTechnicalRequirementsFromText,
  rankSubstituteParts,
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

  /**
   * Bootstrap demo industrial profiles onto existing org products (idempotent-ish merge).
   */
  async bootstrapDemoProfiles(organizationId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: 25,
      orderBy: { updatedAt: 'desc' },
    });
    let updated = 0;
    let i = 0;
    for (const p of products) {
      const existing = industrialProfileFromProduct(p);
      if (
        existing.oemPartNumber ||
        (existing.technicalSpecifications?.length ?? 0) > 0
      ) {
        continue;
      }
      const demo = demoIndustrialForIndex(i, p);
      const prev =
        p.attributesJson && typeof p.attributesJson === 'object'
          ? (p.attributesJson as Record<string, unknown>)
          : {};
      await this.prisma.client.product.update({
        where: { id: p.id },
        data: {
          attributesJson: { ...prev, industrial: demo } as object,
          manufacturer: demo.manufacturer ?? p.manufacturer,
          brand: demo.brand ?? p.brand,
          countryOfOrigin: demo.countryOfOrigin ?? p.countryOfOrigin,
        },
      });
      updated += 1;
      i += 1;
    }
    return {
      scanned: products.length,
      updated,
      honesty: {
        note: 'Demo industrial attributes for local evaluation. Labeled via product sourcePlatform when fixture.',
      },
    };
  }

  /** Locate compatible / substitute parts for a product or free-text requirement. */
  async findCompatible(
    organizationId: string,
    input: { productId?: string; requirementText?: string; take?: number },
  ) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      take: 80,
    });
    const reqs = input.requirementText
      ? parseTechnicalRequirementsFromText(input.requirementText)
      : [];

    if (input.productId) {
      const target = products.find((p) => p.id === input.productId);
      if (!target) throw new NotFoundException('Product not found');
      const profile = industrialProfileFromProduct(target);
      const ranked = rankSubstituteParts(
        profile,
        products
          .filter((p) => p.id !== target.id)
          .map((p) => ({
            productId: p.id,
            title: p.title,
            profile: industrialProfileFromProduct(p),
          })),
      ).slice(0, input.take ?? 10);
      return {
        mode: 'substitutes' as const,
        productId: input.productId,
        requirements: reqs,
        results: ranked,
        honesty: {
          note: 'Substitute ranking uses OEM/MPN family and shared specs — not invented live stock.',
        },
      };
    }

    // Spec match search across catalog
    const results = products
      .map((p) => {
        const profile = industrialProfileFromProduct(p);
        const fit =
          reqs.length === 0
            ? { matched: 0, total: 0, missing: [] as string[], details: [] as Array<{ key: string; ok: boolean }> }
            : matchRequirements(profile, reqs);
        const ratio = fit.total === 0 ? 0 : fit.matched / fit.total;
        return {
          productId: p.id,
          title: p.title,
          manufacturer: profile.manufacturer,
          mpn: profile.manufacturerPartNumber,
          oemPartNumber: profile.oemPartNumber,
          fitRatio: ratio,
          matched: fit.matched,
          total: fit.total,
          missing: fit.missing,
          isFixture: p.sourcePlatform.startsWith('fixture'),
        };
      })
      .filter((r) => (reqs.length === 0 ? true : r.matched > 0))
      .sort((a, b) => b.fitRatio - a.fitRatio || b.matched - a.matched)
      .slice(0, input.take ?? 15);

    return {
      mode: 'spec_search' as const,
      requirements: reqs,
      results,
      honesty: {
        note: reqs.length
          ? 'Matched against industrial technicalSpecifications on the product twin.'
          : 'No parseable requirements — returning empty-filtered catalog slice.',
      },
    };
  }

  parseRequirements(text: string) {
    return {
      requirements: parseTechnicalRequirementsFromText(text),
      honesty: {
        note: 'Rule parser for common industrial patterns (V, IP, psi, lead time, material).',
      },
    };
  }
}

function demoIndustrialForIndex(
  index: number,
  p: { title: string; externalId: string; supplierCostMinor: number; targetPriceMinor: number; currency: string },
): IndustrialProductProfile {
  const samples: Array<Partial<IndustrialProductProfile>> = [
    {
      verticals: ['hydraulics'],
      manufacturer: 'Acme Hydraulics',
      brand: 'Acme',
      oemPartNumber: `OEM-HYD-${1000 + index}`,
      manufacturerPartNumber: `MPN-HYD-${2000 + index}`,
      technicalSpecifications: [
        { key: 'pressure', value: '3000', unit: 'psi' },
        { key: 'port', value: '1/2 NPT' },
      ],
      leadTimeDays: 21,
      moq: 5,
      countryOfOrigin: 'DE',
      materials: ['steel'],
      certifications: ['ISO 9001'],
    },
    {
      verticals: ['electrical'],
      manufacturer: 'VoltWorks',
      brand: 'VW',
      oemPartNumber: `OEM-EL-${1000 + index}`,
      manufacturerPartNumber: `MPN-EL-${2000 + index}`,
      technicalSpecifications: [
        { key: 'voltage', value: '24', unit: 'V' },
        { key: 'ip', value: '67' },
      ],
      leadTimeDays: 14,
      moq: 10,
      countryOfOrigin: 'US',
      materials: ['ABS', 'copper'],
      certifications: ['UL', 'CE'],
    },
    {
      verticals: ['safety_equipment'],
      manufacturer: 'SafeGuard',
      brand: 'SG',
      oemPartNumber: `OEM-SF-${1000 + index}`,
      manufacturerPartNumber: `MPN-SF-${2000 + index}`,
      technicalSpecifications: [
        { key: 'ppeCategory', value: 'III' },
        { key: 'ansi', value: 'Z87.1' },
      ],
      leadTimeDays: 7,
      moq: 20,
      countryOfOrigin: 'US',
      hazmatClass: undefined,
      certifications: ['ANSI'],
    },
  ];
  const s = samples[index % samples.length]!;
  return {
    schemaVersion: 'industrial-v1',
    commerceMode: 'hybrid',
    verticals: s.verticals ?? [],
    manufacturer: s.manufacturer,
    brand: s.brand,
    oemPartNumber: s.oemPartNumber,
    manufacturerPartNumber: s.manufacturerPartNumber,
    sku: p.externalId,
    technicalSpecifications: s.technicalSpecifications ?? [],
    materials: s.materials ?? [],
    certifications: s.certifications ?? [],
    documents: [],
    relations: [],
    leadTimeDays: s.leadTimeDays,
    moq: s.moq,
    countryOfOrigin: s.countryOfOrigin,
    costMinor: p.supplierCostMinor,
    listPriceMinor: p.targetPriceMinor,
    currency: p.currency,
    hazmatClass: s.hazmatClass,
  };
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
