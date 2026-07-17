/**
 * Channel media compatibility rules — pure functions (no network).
 * Live publish remains credential-gated; these rules score readiness only.
 */

export type MediaRow = {
  id?: string;
  artifactType: string;
  purpose: string;
  publicationStatus: string;
  rightsStatus: string;
  visibility: string;
  width: number | null;
  height: number | null;
  durationSeconds?: number | null;
  mimeType?: string | null;
  qualityScore?: number | null;
};

export type ChannelReadinessResult = {
  channel: string;
  listingEligible: boolean;
  issues: string[];
  recommendedCorrections: string[];
  details: Record<string, unknown>;
  publishStatus:
    | 'operational_local'
    | 'connector_capability_declared'
    | 'credential_blocked'
    | 'rights_blocked'
    | 'incomplete';
};

function readyImages(rows: MediaRow[]) {
  return rows.filter(
    (r) =>
      r.artifactType === 'image' &&
      (r.publicationStatus === 'ready' || r.publicationStatus === 'published'),
  );
}

function primaryImage(rows: MediaRow[]) {
  const imgs = readyImages(rows);
  return imgs.find((r) => r.purpose === 'primary') ?? imgs[0];
}

/** Google Merchant: image_link + additional_image_link; 500×500 guidance / 2027 minimum. */
export function evaluateGoogleMediaReadiness(rows: MediaRow[]): ChannelReadinessResult {
  const imgs = readyImages(rows);
  const primary = primaryImage(rows);
  const minDim = primary ? Math.min(primary.width ?? 0, primary.height ?? 0) : 0;
  const issues: string[] = [];
  const recommendedCorrections: string[] = [];

  if (!primary) {
    issues.push('Missing primary image (image_link)');
    recommendedCorrections.push('Bootstrap or ingest a primary product image ≥500×500');
  }
  if (primary && minDim < 500) {
    issues.push('Primary image below 500×500 minimum guidance (required 2027-01-31)');
    recommendedCorrections.push('Replace primary with high-resolution image ≥1000×1000 recommended');
  }
  const rightsBlocked =
    primary &&
    ['unknown', 'restricted', 'marketplace_limited'].includes(primary.rightsStatus);
  if (rightsBlocked) {
    issues.push('Primary image rights not listing-eligible');
    recommendedCorrections.push('Verify supplier/merchant rights before Google sync');
  }
  if (primary && primary.visibility === 'restricted') {
    issues.push('Primary image visibility is restricted');
  }

  const listingEligible =
    Boolean(primary) && minDim >= 500 && !rightsBlocked && primary!.visibility !== 'restricted';

  return {
    channel: 'google_merchant',
    listingEligible,
    issues,
    recommendedCorrections,
    details: {
      primaryImagePresent: Boolean(primary),
      additionalImages: Math.max(0, imgs.length - (primary ? 1 : 0)),
      resolutionOk: minDim >= 500,
      highResRecommended: minDim >= 1000,
      rightsOk: primary ? !rightsBlocked : false,
      processingStatus: primary?.publicationStatus ?? 'none',
      lastSynchronization: null,
      policyIssues: issues,
      accessibility: {
        altTextRecommended: true,
        note: 'Provide descriptive alt text for accessibility and Shopping quality',
      },
    },
    publishStatus: listingEligible
      ? 'connector_capability_declared'
      : rightsBlocked
        ? 'rights_blocked'
        : 'incomplete',
  };
}

/** Shopify GraphQL product media: images, hosted video, external video, 3D models. */
export function evaluateShopifyMediaReadiness(rows: MediaRow[]): ChannelReadinessResult {
  const images = readyImages(rows).length;
  const videos = rows.filter(
    (r) => r.artifactType === 'video' || r.artifactType === 'external_video',
  ).length;
  const models3d = rows.filter((r) => r.artifactType === 'model_3d').length;
  const issues: string[] = [];
  if (images === 0) issues.push('No ready product images for Shopify media');
  return {
    channel: 'shopify',
    listingEligible: images > 0,
    issues,
    recommendedCorrections:
      images === 0 ? ['Attach at least one ready image via GraphQL productCreateMedia when authorized'] : [],
    details: {
      images,
      videos,
      models3d,
      supports: ['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D'],
      api: 'Admin GraphQL product media (not legacy REST-only patterns)',
      note: 'Live Shopify media GraphQL publish is credential-gated.',
    },
    publishStatus: 'credential_blocked',
  };
}

/**
 * eBay Media API — images, video, regulatory documents.
 * Do NOT use legacy UploadSiteHostedPictures (decommission 2026-09-30).
 */
export function evaluateEbayMediaReadiness(rows: MediaRow[]): ChannelReadinessResult {
  const images = readyImages(rows).length;
  const videos = rows.filter((r) => r.artifactType === 'video').length;
  const documents = rows.filter((r) => r.artifactType === 'document').length;
  const issues: string[] = [];
  if (images === 0) issues.push('No ready images for eBay Media API');
  return {
    channel: 'ebay',
    listingEligible: images > 0,
    issues,
    recommendedCorrections:
      images === 0
        ? ['Create image resources via Commerce Media API (file or URL), not UploadSiteHostedPictures']
        : [],
    details: {
      images,
      videos,
      documents,
      api: 'eBay Commerce Media API',
      legacyUploadSiteHostedPictures: 'do_not_use_decommission_2026-09-30',
      note: 'Video IDs associate with inventory items/listings when authorized.',
    },
    publishStatus: 'credential_blocked',
  };
}

/**
 * Amazon SP-API Catalog Items — retrieve image sets within app permissions.
 * Do not imply free republish of all catalog images.
 */
export function evaluateAmazonMediaReadiness(rows: MediaRow[]): ChannelReadinessResult {
  const images = readyImages(rows);
  const marketplaceLimited = images.filter((r) => r.rightsStatus === 'marketplace_limited').length;
  return {
    channel: 'amazon',
    listingEligible: false,
    issues: [
      'Amazon catalog image retrieval requires authorized SP-API seller/vendor permissions',
      ...(marketplaceLimited
        ? [`${marketplaceLimited} image(s) marked marketplace_limited — do not republish freely`]
        : []),
    ],
    recommendedCorrections: [
      'Use Catalog Items API only within approved permissions',
      'Validate listing image requirements via listing APIs separately',
    ],
    details: {
      localReadyImages: images.length,
      marketplaceLimited,
      api: 'Catalog Items API (images + attributes)',
      republishPolicy: 'not_implied_without_permissions',
    },
    publishStatus: 'credential_blocked',
  };
}

/** Map TradeOps artifact to Shopify media content type. */
export function mapToShopifyMediaType(
  artifactType: string,
): 'IMAGE' | 'VIDEO' | 'EXTERNAL_VIDEO' | 'MODEL_3D' | null {
  switch (artifactType) {
    case 'image':
      return 'IMAGE';
    case 'video':
      return 'VIDEO';
    case 'external_video':
      return 'EXTERNAL_VIDEO';
    case 'model_3d':
      return 'MODEL_3D';
    default:
      return null;
  }
}

/** Map TradeOps artifact to eBay Media API resource class. */
export function mapToEbayMediaResource(
  artifactType: string,
): 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null {
  switch (artifactType) {
    case 'image':
      return 'IMAGE';
    case 'video':
      return 'VIDEO';
    case 'document':
      return 'DOCUMENT';
    default:
      return null;
  }
}

/** Select listing-eligible media for a channel draft (references, not copies). */
export function selectListingMedia(
  rows: Array<MediaRow & { id: string }>,
  channel: 'google_merchant' | 'shopify' | 'ebay' | 'fixture_marketplace',
): { selectedArtifactIds: string[]; blocked: string[]; note: string } {
  const selected: string[] = [];
  const blocked: string[] = [];
  for (const r of rows) {
    if (r.publicationStatus !== 'ready' && r.publicationStatus !== 'published') {
      blocked.push(`${r.id}:not_ready`);
      continue;
    }
    if (['unknown', 'restricted'].includes(r.rightsStatus) && r.artifactType === 'image') {
      // Unknown rights: allow internal draft reference but flag
      if (channel === 'google_merchant') {
        blocked.push(`${r.id}:rights_unknown`);
        continue;
      }
    }
    if (r.visibility === 'restricted') {
      blocked.push(`${r.id}:restricted`);
      continue;
    }
    if (r.artifactType === 'image' || r.artifactType === 'document') {
      if (r.visibility === 'listing_eligible' || r.purpose === 'primary' || r.purpose === 'gallery') {
        selected.push(r.id);
      }
    }
  }
  // Ensure primary first if present
  const primary = rows.find((r) => r.purpose === 'primary' && selected.includes(r.id));
  const ordered = primary
    ? [primary.id, ...selected.filter((id) => id !== primary.id)]
    : selected;
  return {
    selectedArtifactIds: ordered,
    blocked,
    note: 'Listing media uses artifact references — no file duplication.',
  };
}
