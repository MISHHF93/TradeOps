import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import {
  ARTIFACT_SYNC_MAX_BYTES,
  artifactTypeFromMime,
  extensionFromMime,
  isAllowedArtifactMime,
  isUnsafeSvgPayload,
  sanitizeFilename,
  simplePerceptualHash,
  validateRemoteArtifactUrl,
} from './artifact-security';
import {
  createLocalArtifactStorage,
  type ArtifactStorageProvider,
} from './artifact-storage';
import {
  evaluateAmazonMediaReadiness,
  evaluateEbayMediaReadiness,
  evaluateGoogleMediaReadiness,
  evaluateShopifyMediaReadiness,
  mapToEbayMediaResource,
  mapToShopifyMediaType,
  selectListingMedia,
} from './channel-media-rules';
import { analyzeArtifactContent } from './artifact-analysis';
import { discoverSupplierArtifacts } from './supplier-artifact-adapter';

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Product Media & Artifact Engine — first-class Product Digital Twin media.
 * Local/dev storage by default; connector live publish remains capability-gated.
 */
@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);
  private readonly storage: ArtifactStorageProvider = createLocalArtifactStorage();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForProduct(organizationId: string, productId: string) {
    await this.requireProduct(organizationId, productId);
    const rows = await this.prisma.client.productArtifact.findMany({
      where: { organizationId, productId },
      orderBy: [{ purpose: 'asc' }, { collectedAt: 'desc' }],
    });
    const readiness = this.channelMediaReadiness(rows);
    const duplicates = this.detectDuplicateRelationships(rows);
    return {
      productId,
      artifacts: rows.map((r) => this.toDto(r)),
      completeness: this.completeness(rows),
      channelReadiness: readiness,
      duplicates,
      storage: {
        providerId: this.storage.providerId,
        accessPolicy: this.storage.accessPolicy,
      },
      honesty: {
        note: 'Artifacts are tenant-isolated. Fixture-generated media is labeled and not merchant-owned marketplace content.',
      },
      operationStatus: this.operationStatusMatrix(),
    };
  }

  /**
   * Discover + materialize supplier/fixture media set for a product (idempotent by checksum).
   */
  async bootstrapFromProductSources(
    organizationId: string,
    productId: string,
    userId?: string | null,
  ) {
    const product = await this.requireProduct(organizationId, productId);
    const created: string[] = [];

    // Primary + gallery image placeholders derived from product (local, tenant-scoped)
    const primary = await this.ensureGeneratedImage({
      organizationId,
      productId,
      purpose: 'primary',
      title: `${product.title} — primary`,
      altText: product.title,
      label: 'PRIMARY',
      sourcePlatform: product.sourcePlatform,
      rightsStatus: product.sourcePlatform.startsWith('fixture')
        ? 'supplier_authorized'
        : 'unknown',
      visibility: 'listing_eligible',
      width: 1200,
      height: 1200,
    });
    if (primary.created) created.push(primary.id);

    const gallery = await this.ensureGeneratedImage({
      organizationId,
      productId,
      purpose: 'gallery',
      title: `${product.title} — gallery 1`,
      altText: `${product.title} alternate angle`,
      label: 'GALLERY',
      sourcePlatform: product.sourcePlatform,
      rightsStatus: product.sourcePlatform.startsWith('fixture')
        ? 'supplier_authorized'
        : 'unknown',
      visibility: 'listing_eligible',
      width: 1000,
      height: 1000,
    });
    if (gallery.created) created.push(gallery.id);

    const packaging = await this.ensureGeneratedImage({
      organizationId,
      productId,
      purpose: 'packaging',
      title: `${product.title} — packaging`,
      altText: 'Packaging',
      label: 'PACK',
      sourcePlatform: product.sourcePlatform,
      rightsStatus: product.sourcePlatform.startsWith('fixture')
        ? 'supplier_authorized'
        : 'unknown',
      visibility: 'internal',
      width: 800,
      height: 800,
    });
    if (packaging.created) created.push(packaging.id);

    // Spec sheet (structured + document stub). Checksum is stable (no timestamps).
    const spec = await this.ensureDocument({
      organizationId,
      productId,
      purpose: 'specification',
      title: `${product.title} — specification sheet`,
      filename: 'specification.txt',
      mimeType: 'text/plain',
      body: [
        `Product: ${product.title}`,
        `Category: ${product.category}`,
        `Brand: ${product.brand ?? '—'}`,
        `Source: ${product.sourcePlatform}`,
        `External ID: ${product.externalId}`,
        `Currency: ${product.currency}`,
        `Supplier cost (minor): ${product.supplierCostMinor}`,
        `Shipping cost (minor): ${product.shippingCostMinor}`,
        product.sourcePlatform.startsWith('fixture')
          ? 'TEST FIXTURE — NOT LIVE DATA'
          : 'Merchant/product store record',
      ].join('\n'),
      sourcePlatform: product.sourcePlatform,
      rightsStatus: product.sourcePlatform.startsWith('fixture')
        ? 'supplier_authorized'
        : 'merchant_owned',
    });
    if (spec.created) created.push(spec.id);

    const manual = await this.ensureDocument({
      organizationId,
      productId,
      purpose: 'manual',
      title: `${product.title} — user manual`,
      filename: 'manual.txt',
      mimeType: 'text/plain',
      body: [
        `User manual (placeholder)`,
        `Product: ${product.title}`,
        `Install and use according to manufacturer guidance.`,
        `This artifact is provisional until a supplier PDF is ingested.`,
      ].join('\n'),
      sourcePlatform: product.sourcePlatform,
      rightsStatus: 'unknown',
    });
    if (manual.created) created.push(manual.id);

    const warranty = await this.ensureDocument({
      organizationId,
      productId,
      purpose: 'warranty',
      title: `${product.title} — warranty`,
      filename: 'warranty.txt',
      mimeType: 'text/plain',
      body: [
        `Warranty document (placeholder)`,
        `Product: ${product.title}`,
        `Standard limited warranty terms pending supplier PDF.`,
        product.sourcePlatform.startsWith('fixture')
          ? 'TEST FIXTURE — NOT LIVE DATA'
          : 'Merchant record',
      ].join('\n'),
      sourcePlatform: product.sourcePlatform,
      rightsStatus: product.sourcePlatform.startsWith('fixture')
        ? 'supplier_authorized'
        : 'unknown',
    });
    if (warranty.created) created.push(warranty.id);

    // 3D model metadata stub (no binary — graceful browser fallback)
    const model3d = await this.ensureModel3dStub({
      organizationId,
      productId,
      title: `${product.title} — 3D model slot`,
      sourcePlatform: product.sourcePlatform,
    });
    if (model3d.created) created.push(model3d.id);

    // Discover supplier feed-style media URLs from product denormalized media fields
    const galleryUrls = Array.isArray(product.galleryImageUrlsJson)
      ? (product.galleryImageUrlsJson as unknown[]).filter(
          (u): u is string => typeof u === 'string',
        )
      : [];
    const mediaArr = Array.isArray(product.mediaJson)
      ? (product.mediaJson as Array<Record<string, unknown>>)
      : [];
    const discovered = discoverSupplierArtifacts(
      {
        title: product.title,
        externalId: product.externalId,
        imageUrl: product.primaryImageUrl ?? undefined,
        images: galleryUrls.length
          ? galleryUrls
          : mediaArr
              .filter((m) => m.kind === 'image' && typeof m.url === 'string')
              .map((m) => ({
                url: String(m.url),
                alt: typeof m.altText === 'string' ? m.altText : undefined,
                purpose: typeof m.purpose === 'string' ? m.purpose : undefined,
              })),
        videos: mediaArr
          .filter((m) => m.kind === 'video' && typeof m.url === 'string')
          .map((m) => String(m.url)),
        documents: mediaArr
          .filter((m) => m.kind === 'document' && typeof m.url === 'string')
          .map((m) => ({
            url: String(m.url),
            title: typeof m.title === 'string' ? m.title : undefined,
          })),
      },
      { treatAsAuthorized: product.sourcePlatform.startsWith('fixture') },
    );
    // Register discovered URLs as external references (full binary ingest via ingestFromUrl)
    for (const d of discovered.slice(0, 12)) {
      if (!d.externalUrl) continue;
      try {
        await this.ensureExternalReferenceArtifact({
          organizationId,
          productId,
          discovered: d,
          sourcePlatform: product.sourcePlatform,
        });
      } catch {
        /* keep going */
      }
    }

    // External video reference (YouTube-style placeholder — not downloaded)
    const videoChecksum = sha256(`external-video:${product.id}:demo`);
    const existingVideo = await this.prisma.client.productArtifact.findFirst({
      where: { organizationId, productId, checksum: videoChecksum },
    });
    if (!existingVideo) {
      const v = await this.prisma.client.productArtifact.create({
        data: {
          organizationId,
          productId,
          artifactType: 'external_video',
          purpose: 'demonstration',
          sourceType: product.sourcePlatform.startsWith('fixture')
            ? 'supplier'
            : 'import',
          sourcePlatform: product.sourcePlatform,
          externalUrl: null,
          title: `${product.title} — demonstration (not yet linked)`,
          description:
            'External video slot reserved. Attach authorized YouTube/Vimeo/Shopify-hosted URL when available.',
          checksum: videoChecksum,
          rightsStatus: 'unknown',
          publicationStatus: 'discovered',
          visibility: 'internal',
          durationSeconds: null,
          confidence: 0.3,
          qualityScore: 0,
          metadataJson: {
            provider: 'external',
            status: 'awaiting_authorized_url',
          },
        },
      });
      created.push(v.id);
    }

    await this.audit.write({
      action: 'product.artifacts.bootstrap',
      resourceType: 'product',
      resourceId: productId,
      organizationId,
      actorUserId: userId ?? null,
      metadata: { createdCount: created.length, created },
    });

    return this.listForProduct(organizationId, productId);
  }

  /**
   * Ingest authorized remote URL (https) with SSRF protection + checksum dedupe.
   * Downloads only when size is small and content-type is allowed.
   */
  async ingestRemoteUrl(input: {
    organizationId: string;
    productId: string;
    userId?: string | null;
    url: string;
    purpose?: string;
    artifactType?: string;
    title?: string;
  }) {
    await this.requireProduct(input.organizationId, input.productId);
    const safe = validateRemoteArtifactUrl(input.url);
    if (!safe.ok) throw new BadRequestException(safe.reason);
    const url = safe.url;

    // Head-like fetch with limit
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'TradeOps-ArtifactIngest/0.1' },
      });
    } catch (e) {
      throw new BadRequestException(
        `Failed to fetch artifact: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new BadRequestException(`Remote artifact returned HTTP ${res.status}`);
    }
    const mime = (res.headers.get('content-type') ?? 'application/octet-stream')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (!isAllowedArtifactMime(mime)) {
      throw new BadRequestException(`MIME type not allowed for ingestion: ${mime}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > ARTIFACT_SYNC_MAX_BYTES) {
      throw new BadRequestException(
        `Artifact exceeds ${ARTIFACT_SYNC_MAX_BYTES} byte sync ingest limit — use async worker path`,
      );
    }
    if (isUnsafeSvgPayload(buf, mime)) {
      throw new BadRequestException('SVG payload rejected (scriptable content)');
    }
    const checksum = sha256(buf);
    const existing = await this.prisma.client.productArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        checksum,
      },
    });
    if (existing) {
      return { artifact: this.toDto(existing), deduped: true };
    }

    const artifactType =
      (input.artifactType as 'image' | 'video' | 'document' | undefined) ??
      artifactTypeFromMime(mime);
    const purpose = (input.purpose as 'gallery' | 'primary' | 'manual' | 'other') ?? 'gallery';
    const ext = extensionFromMime(mime);

    const id = cryptoRandomId();
    const storageKey = this.storage.resolveKey({
      organizationId: input.organizationId,
      productId: input.productId,
      artifactId: id,
      name: `original.${ext}`,
    });
    this.storage.writeObject(storageKey, buf);

    const row = await this.prisma.client.productArtifact.create({
      data: {
        id,
        organizationId: input.organizationId,
        productId: input.productId,
        artifactType,
        purpose,
        sourceType: 'public_url',
        externalUrl: url.toString(),
        storageKey,
        filename: sanitizeFilename(url.pathname.split('/').pop() || `artifact.${ext}`),
        mimeType: mime,
        extension: ext,
        fileSizeBytes: buf.length,
        checksum,
        perceptualHash: mime.startsWith('image/') ? simplePerceptualHash(buf) : null,
        title:
          input.title ??
          sanitizeFilename(url.pathname.split('/').pop() || 'Ingested artifact'),
        rightsStatus: 'unknown',
        publicationStatus: 'ready',
        visibility: 'internal',
        confidence: 0.6,
        qualityScore: mime.startsWith('image/') ? 60 : 50,
        validatedAt: new Date(),
        metadataJson: {
          ingest: 'remote_url',
          ssrfProtected: true,
        },
      },
    });

    await this.audit.write({
      action: 'product.artifact.ingested',
      resourceType: 'product_artifact',
      resourceId: row.id,
      organizationId: input.organizationId,
      actorUserId: input.userId ?? null,
      metadata: { productId: input.productId, mime, bytes: buf.length },
    });

    return { artifact: this.toDto(row), deduped: false };
  }

  async setPrimary(organizationId: string, productId: string, artifactId: string) {
    await this.requireProduct(organizationId, productId);
    const art = await this.prisma.client.productArtifact.findFirst({
      where: { id: artifactId, organizationId, productId },
    });
    if (!art) throw new NotFoundException('Artifact not found');
    if (art.artifactType !== 'image') {
      throw new BadRequestException('Only images can be primary product images');
    }
    await this.prisma.client.productArtifact.updateMany({
      where: {
        organizationId,
        productId,
        purpose: 'primary',
        id: { not: artifactId },
      },
      data: { purpose: 'gallery' },
    });
    const updated = await this.prisma.client.productArtifact.update({
      where: { id: artifactId },
      data: {
        purpose: 'primary',
        visibility: 'listing_eligible',
        publicationStatus: art.publicationStatus === 'ready' ? 'ready' : art.publicationStatus,
      },
    });
    return this.toDto(updated);
  }

  /** Controlled content access for stored objects (tenant-scoped) — streams when possible */
  async readObjectStream(
    organizationId: string,
    artifactId: string,
  ): Promise<{
    mimeType: string;
    body: Buffer | ReadStream;
    filename: string;
    stream: boolean;
  }> {
    const art = await this.prisma.client.productArtifact.findFirst({
      where: { id: artifactId, organizationId },
    });
    if (!art?.storageKey) throw new NotFoundException('Artifact content not available');
    if (!this.storage.exists(art.storageKey)) {
      throw new NotFoundException('Artifact file missing from storage');
    }
    const size = art.fileSizeBytes ?? 0;
    // Small files: buffer; larger: stream to avoid loading full media into memory
    if (size > 256 * 1024) {
      return {
        mimeType: art.mimeType ?? 'application/octet-stream',
        body: this.storage.openReadStream(art.storageKey),
        filename: art.filename ?? 'artifact',
        stream: true,
      };
    }
    return {
      mimeType: art.mimeType ?? 'application/octet-stream',
      body: this.storage.readObject(art.storageKey),
      filename: art.filename ?? 'artifact',
      stream: false,
    };
  }

  /** Rule-based multimodal analysis — always labeled as proposal */
  async analyzeArtifact(organizationId: string, productId: string, artifactId: string) {
    await this.requireProduct(organizationId, productId);
    const art = await this.prisma.client.productArtifact.findFirst({
      where: { id: artifactId, organizationId, productId },
    });
    if (!art) throw new NotFoundException('Artifact not found');

    let bodyTextSample: string | null = null;
    if (art.storageKey && art.mimeType?.startsWith('text/') && this.storage.exists(art.storageKey)) {
      try {
        bodyTextSample = this.storage.readObject(art.storageKey).toString('utf8').slice(0, 2000);
      } catch {
        bodyTextSample = null;
      }
    }

    const proposal = analyzeArtifactContent({
      artifactId: art.id,
      artifactType: art.artifactType,
      purpose: art.purpose,
      title: art.title,
      altText: art.altText,
      description: art.description,
      mimeType: art.mimeType,
      width: art.width,
      height: art.height,
      durationSeconds: art.durationSeconds,
      pageCount: art.pageCount,
      bodyTextSample,
      sourcePlatform: art.sourcePlatform,
    });

    // Persist proposal under metadata (does not mutate product attributes as truth)
    const prev = (art.metadataJson ?? {}) as Record<string, unknown>;
    const nextMeta = JSON.parse(
      JSON.stringify({ ...prev, lastAnalysis: proposal }),
    ) as object;
    await this.prisma.client.productArtifact.update({
      where: { id: art.id },
      data: { metadataJson: nextMeta },
    });

    return {
      proposal,
      honesty: {
        note: 'Inferred attributes are proposals — not ground truth. Human review required before listing use.',
      },
    };
  }

  /** Channel-ready media selection for listing drafts (references only) */
  async listingMediaPlan(
    organizationId: string,
    productId: string,
    channel:
      | 'google_merchant'
      | 'shopify'
      | 'ebay'
      | 'fixture_marketplace' = 'fixture_marketplace',
  ) {
    await this.requireProduct(organizationId, productId);
    const rows = await this.prisma.client.productArtifact.findMany({
      where: { organizationId, productId },
    });
    const selection = selectListingMedia(
      rows.map((r) => ({
        id: r.id,
        artifactType: r.artifactType,
        purpose: r.purpose,
        publicationStatus: r.publicationStatus,
        rightsStatus: r.rightsStatus,
        visibility: r.visibility,
        width: r.width,
        height: r.height,
      })),
      channel,
    );
    const channelEval =
      channel === 'google_merchant'
        ? evaluateGoogleMediaReadiness(rows)
        : channel === 'shopify'
          ? evaluateShopifyMediaReadiness(rows)
          : channel === 'ebay'
            ? evaluateEbayMediaReadiness(rows)
            : evaluateGoogleMediaReadiness(rows);

    return {
      productId,
      channel,
      ...selection,
      channelReadiness: channelEval,
      shopifyTypes: rows.map((r) => ({
        id: r.id,
        shopifyMediaType: mapToShopifyMediaType(r.artifactType),
      })),
      ebayResources: rows.map((r) => ({
        id: r.id,
        ebayResource: mapToEbayMediaResource(r.artifactType),
      })),
    };
  }

  // ——— internals ———

  private operationStatusMatrix() {
    return {
      list: 'operational',
      bootstrap: 'operational',
      ingestRemoteUrl: 'operational',
      setPrimary: 'operational',
      contentProxy: 'operational',
      analyzeProposal: 'operational',
      listingMediaPlan: 'operational',
      duplicateDetection: 'operational',
      localStorage: 'operational',
      s3GcsR2: 'incomplete',
      merchantMultipartUpload: 'incomplete',
      asyncVideoWorker: 'incomplete',
      shopifyGraphqlPublish: 'credential_blocked',
      ebayMediaApiPublish: 'credential_blocked',
      amazonCatalogImages: 'credential_blocked',
      googleMerchantLiveSync: 'credential_blocked',
      malwareScannerAppliance: 'incomplete',
    };
  }

  private detectDuplicateRelationships(
    rows: Array<{
      id: string;
      checksum: string | null;
      perceptualHash: string | null;
      title: string | null;
      purpose: string;
    }>,
  ) {
    const exactGroups = new Map<string, string[]>();
    const nearGroups = new Map<string, string[]>();
    for (const r of rows) {
      if (r.checksum) {
        const g = exactGroups.get(r.checksum) ?? [];
        g.push(r.id);
        exactGroups.set(r.checksum, g);
      }
      if (r.perceptualHash) {
        const g = nearGroups.get(r.perceptualHash) ?? [];
        g.push(r.id);
        nearGroups.set(r.perceptualHash, g);
      }
    }
    const exact = [...exactGroups.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([checksum, artifactIds]) => ({
        kind: 'exact_checksum' as const,
        checksum,
        artifactIds,
      }));
    const near = [...nearGroups.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([perceptualHash, artifactIds]) => ({
        kind: 'near_perceptual' as const,
        perceptualHash,
        artifactIds,
        note: 'Shown as relationship — not auto-deleted',
      }));
    return { exact, near };
  }

  private channelMediaReadiness(
    rows: Array<{
      artifactType: string;
      purpose: string;
      publicationStatus: string;
      width: number | null;
      height: number | null;
      rightsStatus: string;
      visibility: string;
    }>,
  ) {
    const googleFull = evaluateGoogleMediaReadiness(rows);
    const shopifyFull = evaluateShopifyMediaReadiness(rows);
    const ebayFull = evaluateEbayMediaReadiness(rows);
    const amazonFull = evaluateAmazonMediaReadiness(rows);

    // Backward-compatible shape for existing UI + richer channel objects
    return {
      google: {
        channel: 'google_merchant',
        primaryImagePresent: Boolean(googleFull.details.primaryImagePresent),
        additionalImages: Number(googleFull.details.additionalImages ?? 0),
        resolutionOk: Boolean(googleFull.details.resolutionOk),
        highResRecommended: Boolean(googleFull.details.highResRecommended),
        rightsOk: Boolean(googleFull.details.rightsOk),
        listingEligible: googleFull.listingEligible,
        issues: googleFull.issues,
        recommendedCorrections: googleFull.recommendedCorrections,
        processingStatus: googleFull.details.processingStatus,
        lastSynchronization: googleFull.details.lastSynchronization,
        policyIssues: googleFull.details.policyIssues,
        accessibility: googleFull.details.accessibility,
        publishStatus: googleFull.publishStatus,
      },
      shopify: {
        ...shopifyFull.details,
        channel: 'shopify',
        listingEligible: shopifyFull.listingEligible,
        issues: shopifyFull.issues,
        note: String(shopifyFull.details.note ?? ''),
        publishStatus: shopifyFull.publishStatus,
      },
      ebay: {
        ...ebayFull.details,
        channel: 'ebay',
        listingEligible: ebayFull.listingEligible,
        issues: ebayFull.issues,
        note: String(ebayFull.details.note ?? ''),
        publishStatus: ebayFull.publishStatus,
      },
      amazon: {
        ...amazonFull.details,
        channel: 'amazon',
        listingEligible: amazonFull.listingEligible,
        issues: amazonFull.issues,
        publishStatus: amazonFull.publishStatus,
      },
    };
  }

  private completeness(
    rows: Array<{ artifactType: string; purpose: string; publicationStatus: string }>,
  ) {
    const has = (t: string, p?: string) =>
      rows.some(
        (r) =>
          r.artifactType === t &&
          (!p || r.purpose === p) &&
          r.publicationStatus !== 'validation_failed' &&
          r.publicationStatus !== 'removed',
      );
    const checks = {
      primaryImage: has('image', 'primary') || has('image'),
      galleryImage: has('image', 'gallery'),
      specification: has('document', 'specification'),
      manual: has('document', 'manual'),
      video: has('video') || has('external_video'),
    };
    const score = Math.round(
      (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100,
    );
    return { score, checks };
  }

  private async ensureGeneratedImage(input: {
    organizationId: string;
    productId: string;
    purpose: 'primary' | 'gallery' | 'packaging';
    title: string;
    altText: string;
    label: string;
    sourcePlatform: string;
    rightsStatus: 'supplier_authorized' | 'unknown' | 'merchant_owned';
    visibility: 'listing_eligible' | 'internal';
    width: number;
    height: number;
  }) {
    const checksum = sha256(
      `gen-img:${input.productId}:${input.purpose}:${input.label}:${input.width}x${input.height}`,
    );
    const existing = await this.prisma.client.productArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        checksum,
      },
    });
    if (existing) return { id: existing.id, created: false };

    const svg = this.svgPlaceholder(input.label, input.title, input.width, input.height);
    const id = cryptoRandomId();
    const storageKey = this.storage.resolveKey({
      organizationId: input.organizationId,
      productId: input.productId,
      artifactId: id,
      name: 'original.svg',
    });
    this.storage.writeObject(storageKey, Buffer.from(svg, 'utf8'));
    const previewKey = this.storage.resolveKey({
      organizationId: input.organizationId,
      productId: input.productId,
      artifactId: id,
      name: 'preview.svg',
    });
    this.storage.writeObject(previewKey, Buffer.from(svg, 'utf8'));

    const row = await this.prisma.client.productArtifact.create({
      data: {
        id,
        organizationId: input.organizationId,
        productId: input.productId,
        artifactType: 'image',
        purpose: input.purpose,
        sourceType: input.sourcePlatform.startsWith('fixture') ? 'supplier' : 'generated',
        sourcePlatform: input.sourcePlatform,
        storageKey,
        filename: `${input.purpose}.svg`,
        mimeType: 'image/svg+xml',
        extension: 'svg',
        fileSizeBytes: Buffer.byteLength(svg),
        width: input.width,
        height: input.height,
        checksum,
        perceptualHash: checksum.slice(0, 16),
        title: input.title,
        altText: input.altText,
        rightsStatus: input.rightsStatus,
        publicationStatus: 'ready',
        visibility: input.visibility,
        qualityScore: input.sourcePlatform.startsWith('fixture') ? 55 : 70,
        confidence: input.sourcePlatform.startsWith('fixture') ? 0.7 : 0.85,
        validatedAt: new Date(),
        metadataJson: {
          generated: true,
          derivativePreview: previewKey,
          fixture: input.sourcePlatform.startsWith('fixture'),
          label: input.sourcePlatform.startsWith('fixture')
            ? 'TEST FIXTURE — NOT LIVE DATA'
            : 'generated_local',
        },
      },
    });
    return { id: row.id, created: true };
  }

  private async ensureDocument(input: {
    organizationId: string;
    productId: string;
    purpose: 'specification' | 'manual' | 'warranty' | 'compliance';
    title: string;
    filename: string;
    mimeType: string;
    body: string;
    sourcePlatform: string;
    rightsStatus: 'supplier_authorized' | 'merchant_owned' | 'unknown';
  }) {
    // Prefer purpose-stable identity so re-bootstrap is idempotent even if body copy changes slightly.
    const stableKey = `doc:${input.productId}:${input.purpose}:v1`;
    const checksum = sha256(stableKey);
    const existing = await this.prisma.client.productArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        OR: [
          { checksum },
          { purpose: input.purpose, artifactType: 'document' },
        ],
      },
    });
    if (existing) return { id: existing.id, created: false };

    const id = cryptoRandomId();
    const storageKey = this.storage.resolveKey({
      organizationId: input.organizationId,
      productId: input.productId,
      artifactId: id,
      name: 'original.txt',
    });
    this.storage.writeObject(storageKey, Buffer.from(input.body, 'utf8'));

    const row = await this.prisma.client.productArtifact.create({
      data: {
        id,
        organizationId: input.organizationId,
        productId: input.productId,
        artifactType: 'document',
        purpose: input.purpose,
        sourceType: input.sourcePlatform.startsWith('fixture') ? 'supplier' : 'generated',
        sourcePlatform: input.sourcePlatform,
        storageKey,
        filename: input.filename,
        mimeType: input.mimeType,
        extension: 'txt',
        fileSizeBytes: Buffer.byteLength(input.body),
        pageCount: 1,
        checksum,
        title: input.title,
        rightsStatus: input.rightsStatus,
        publicationStatus: 'ready',
        visibility: input.purpose === 'manual' ? 'internal' : 'listing_eligible',
        qualityScore: 50,
        confidence: 0.75,
        validatedAt: new Date(),
        metadataJson: {
          generated: true,
          fixture: input.sourcePlatform.startsWith('fixture'),
        },
      },
    });
    return { id: row.id, created: true };
  }

  /**
   * Register a discovered remote media URL as a twin artifact without downloading
   * when binary ingest is deferred. Idempotent by checksum of URL.
   */
  private async ensureExternalReferenceArtifact(input: {
    organizationId: string;
    productId: string;
    sourcePlatform: string;
    discovered: {
      artifactType: string;
      purpose: string;
      externalUrl?: string;
      title?: string;
      rightsStatus: string;
      raw: Record<string, unknown>;
    };
  }) {
    const url = input.discovered.externalUrl;
    if (!url) return { id: '', created: false };
    const checksum = sha256(`ext-ref:${input.productId}:${url}`);
    const existing = await this.prisma.client.productArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        checksum,
      },
    });
    if (existing) return { id: existing.id, created: false };

    const purposeMap: Record<string, string> = {
      primary: 'primary',
      gallery: 'gallery',
      packaging: 'packaging',
      manual: 'manual',
      specification: 'specification',
      warranty: 'warranty',
      compliance: 'compliance',
      demonstration: 'demonstration',
      supplier_evidence: 'supplier_evidence',
      other: 'other',
    };
    const purpose = purposeMap[input.discovered.purpose] ?? 'gallery';
    const artifactType =
      input.discovered.artifactType === 'video'
        ? 'external_video'
        : input.discovered.artifactType === 'document'
          ? 'document'
          : input.discovered.artifactType === 'image'
            ? 'image'
            : 'other';

    const row = await this.prisma.client.productArtifact.create({
      data: {
        organizationId: input.organizationId,
        productId: input.productId,
        artifactType: artifactType as 'image' | 'document' | 'external_video' | 'other',
        purpose: purpose as 'primary' | 'gallery' | 'packaging' | 'other',
        sourceType: input.sourcePlatform.startsWith('fixture') ? 'supplier' : 'public_url',
        sourcePlatform: input.sourcePlatform,
        externalUrl: url,
        title: input.discovered.title ?? 'Source media',
        rightsStatus:
          input.discovered.rightsStatus === 'supplier_authorized'
            ? 'supplier_authorized'
            : 'unknown',
        publicationStatus: 'discovered',
        visibility: purpose === 'primary' || purpose === 'gallery' ? 'listing_eligible' : 'internal',
        checksum,
        confidence: 0.7,
        qualityScore: 55,
        metadataJson: {
          externalReference: true,
          discovered: input.discovered.raw,
          note: 'URL registered on twin; binary may be ingested separately',
        } as object,
        rawSourceJson: input.discovered.raw as object,
      },
    });
    return { id: row.id, created: true };
  }

  private svgPlaceholder(
    label: string,
    title: string,
    w: number,
    h: number,
  ): string {
    const safe = title.replace(/[<>&]/g, '').slice(0, 48);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#0d121b"/>
  <rect x="8%" y="8%" width="84%" height="84%" rx="24" fill="#111824" stroke="#25c7e8" stroke-width="4"/>
  <text x="50%" y="42%" text-anchor="middle" fill="#25c7e8" font-family="Segoe UI, Arial" font-size="48" font-weight="600">${label}</text>
  <text x="50%" y="55%" text-anchor="middle" fill="#b7c1cf" font-family="Segoe UI, Arial" font-size="28">${safe}</text>
  <text x="50%" y="68%" text-anchor="middle" fill="#7f8b9b" font-family="Segoe UI, Arial" font-size="20">${w}×${h} · TradeOps Artifact</text>
</svg>`;
  }

  private async ensureModel3dStub(input: {
    organizationId: string;
    productId: string;
    title: string;
    sourcePlatform: string;
  }) {
    const checksum = sha256(`model3d:${input.productId}:slot:v1`);
    const existing = await this.prisma.client.productArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        checksum,
      },
    });
    if (existing) return { id: existing.id, created: false };

    const id = cryptoRandomId();
    const metaBody = JSON.stringify(
      {
        format: 'glb',
        status: 'slot_reserved',
        browserFallback: true,
        note: 'No binary uploaded — attach authorized GLB when available',
      },
      null,
      2,
    );
    const storageKey = this.storage.resolveKey({
      organizationId: input.organizationId,
      productId: input.productId,
      artifactId: id,
      name: 'model-meta.json',
    });
    this.storage.writeObject(storageKey, Buffer.from(metaBody, 'utf8'));

    const row = await this.prisma.client.productArtifact.create({
      data: {
        id,
        organizationId: input.organizationId,
        productId: input.productId,
        artifactType: 'model_3d',
        purpose: 'other',
        sourceType: input.sourcePlatform.startsWith('fixture') ? 'supplier' : 'generated',
        sourcePlatform: input.sourcePlatform,
        storageKey,
        filename: 'model-meta.json',
        mimeType: 'application/json',
        extension: 'json',
        fileSizeBytes: Buffer.byteLength(metaBody),
        checksum,
        title: input.title,
        description: '3D model slot with graceful browser fallback when no GLB is attached.',
        rightsStatus: 'unknown',
        publicationStatus: 'discovered',
        visibility: 'internal',
        qualityScore: 0,
        confidence: 0.25,
        metadataJson: {
          model3d: true,
          browserFallback: true,
          fixture: input.sourcePlatform.startsWith('fixture'),
        },
      },
    });
    return { id: row.id, created: true };
  }

  private async requireProduct(organizationId: string, productId: string) {
    const p = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  private toDto(r: {
    id: string;
    productId: string;
    artifactType: string;
    purpose: string;
    sourceType: string;
    sourcePlatform: string | null;
    externalUrl: string | null;
    storageKey: string | null;
    filename: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    pageCount: number | null;
    checksum: string | null;
    perceptualHash?: string | null;
    title: string | null;
    altText: string | null;
    description: string | null;
    rightsStatus: string;
    publicationStatus: string;
    visibility: string;
    qualityScore: number | null;
    confidence: number | null;
    collectedAt: Date;
    validatedAt: Date | null;
    metadataJson: unknown;
  }) {
    const meta = (r.metadataJson ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      productId: r.productId,
      artifactType: r.artifactType,
      purpose: r.purpose,
      sourceType: r.sourceType,
      sourcePlatform: r.sourcePlatform,
      externalUrl: r.externalUrl,
      filename: r.filename,
      mimeType: r.mimeType,
      fileSizeBytes: r.fileSizeBytes,
      width: r.width,
      height: r.height,
      durationSeconds: r.durationSeconds,
      pageCount: r.pageCount,
      checksum: r.checksum,
      perceptualHash: r.perceptualHash ?? null,
      title: r.title,
      altText: r.altText,
      description: r.description,
      rightsStatus: r.rightsStatus,
      publicationStatus: r.publicationStatus,
      visibility: r.visibility,
      qualityScore: r.qualityScore,
      confidence: r.confidence,
      collectedAt: r.collectedAt,
      validatedAt: r.validatedAt,
      contentUrl: r.storageKey
        ? `/api/v1/products/${r.productId}/artifacts/${r.id}/content`
        : r.externalUrl,
      shopifyMediaType: mapToShopifyMediaType(r.artifactType),
      ebayMediaResource: mapToEbayMediaResource(r.artifactType),
      provenanceLabel: meta.fixture
        ? 'TEST FIXTURE — NOT LIVE DATA'
        : r.sourceType === 'generated'
          ? 'Generated'
          : r.sourceType === 'public_url'
            ? 'Remote URL (rights unknown until verified)'
            : r.sourcePlatform ?? r.sourceType,
      analysisProposal: meta.lastAnalysis ?? null,
      metadata: meta,
    };
  }
}

function cryptoRandomId(): string {
  return randomUUID();
}
