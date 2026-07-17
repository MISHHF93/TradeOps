/**
 * Generic supplier artifact discovery adapter.
 * Reads media/document references from supplier product records and feeds.
 * Does NOT assume supplier media is safe or listing-ready — callers must
 * run validation + rights checks before publication.
 */

export type DiscoveredSupplierArtifact = {
  sourceType: 'supplier' | 'import';
  artifactType:
    | 'image'
    | 'video'
    | 'external_video'
    | 'document'
    | 'model_3d'
    | 'other';
  purpose:
    | 'primary'
    | 'gallery'
    | 'packaging'
    | 'manual'
    | 'specification'
    | 'warranty'
    | 'compliance'
    | 'demonstration'
    | 'supplier_evidence'
    | 'other';
  externalUrl?: string;
  title?: string;
  filename?: string;
  mimeHint?: string;
  rightsStatus: 'unknown' | 'supplier_authorized';
  raw: Record<string, unknown>;
};

export type SupplierProductMediaRecord = {
  externalId?: string;
  title?: string;
  imageUrl?: string;
  images?: Array<string | { url: string; alt?: string; purpose?: string }>;
  videoUrl?: string;
  videos?: Array<string | { url: string; title?: string }>;
  documents?: Array<{
    url?: string;
    type?: string;
    title?: string;
    filename?: string;
  }>;
  manuals?: string[];
  certificates?: string[];
  media?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
};

function asUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.startsWith('http://') || t.startsWith('https://') ? t : undefined;
}

function purposeFromDocType(type?: string): DiscoveredSupplierArtifact['purpose'] {
  const t = (type ?? '').toLowerCase();
  if (t.includes('manual') || t.includes('install')) return 'manual';
  if (t.includes('spec')) return 'specification';
  if (t.includes('warrant')) return 'warranty';
  if (t.includes('cert') || t.includes('compli') || t.includes('safety')) return 'compliance';
  return 'supplier_evidence';
}

/**
 * Discover artifact references from a supplier product-shaped record.
 * Supports image URLs, video URLs, manuals, PDFs, certificates, JSON media arrays.
 */
export function discoverSupplierArtifacts(
  record: SupplierProductMediaRecord,
  options?: { treatAsAuthorized?: boolean },
): DiscoveredSupplierArtifact[] {
  const rights = options?.treatAsAuthorized ? 'supplier_authorized' : 'unknown';
  const out: DiscoveredSupplierArtifact[] = [];
  const seen = new Set<string>();

  const push = (a: DiscoveredSupplierArtifact) => {
    const key = `${a.artifactType}:${a.externalUrl ?? a.filename ?? a.title ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  if (record.imageUrl) {
    const url = asUrl(record.imageUrl);
    if (url) {
      push({
        sourceType: 'supplier',
        artifactType: 'image',
        purpose: 'primary',
        externalUrl: url,
        title: record.title ? `${record.title} — primary` : 'Primary image',
        rightsStatus: rights,
        raw: { field: 'imageUrl' },
      });
    }
  }

  for (const img of record.images ?? []) {
    const url = typeof img === 'string' ? asUrl(img) : asUrl(img.url);
    if (!url) continue;
    const purpose =
      typeof img === 'object' && img.purpose === 'packaging'
        ? 'packaging'
        : 'gallery';
    push({
      sourceType: 'supplier',
      artifactType: 'image',
      purpose,
      externalUrl: url,
      title: typeof img === 'object' ? img.alt : undefined,
      rightsStatus: rights,
      raw: { field: 'images', value: img },
    });
  }

  if (record.videoUrl) {
    const url = asUrl(record.videoUrl);
    if (url) {
      push({
        sourceType: 'supplier',
        artifactType: url.includes('youtube') || url.includes('vimeo') ? 'external_video' : 'video',
        purpose: 'demonstration',
        externalUrl: url,
        rightsStatus: rights,
        raw: { field: 'videoUrl' },
      });
    }
  }

  for (const v of record.videos ?? []) {
    const url = typeof v === 'string' ? asUrl(v) : asUrl(v.url);
    if (!url) continue;
    push({
      sourceType: 'supplier',
      artifactType: url.includes('youtube') || url.includes('vimeo') ? 'external_video' : 'video',
      purpose: 'demonstration',
      externalUrl: url,
      title: typeof v === 'object' ? v.title : undefined,
      rightsStatus: rights,
      raw: { field: 'videos', value: v },
    });
  }

  for (const d of record.documents ?? []) {
    const url = asUrl(d.url);
    push({
      sourceType: 'supplier',
      artifactType: 'document',
      purpose: purposeFromDocType(d.type),
      externalUrl: url,
      title: d.title,
      filename: d.filename,
      mimeHint: d.filename?.endsWith('.pdf') ? 'application/pdf' : undefined,
      rightsStatus: rights,
      raw: { field: 'documents', value: d },
    });
  }

  for (const m of record.manuals ?? []) {
    const url = asUrl(m);
    push({
      sourceType: 'supplier',
      artifactType: 'document',
      purpose: 'manual',
      externalUrl: url,
      rightsStatus: rights,
      raw: { field: 'manuals', value: m },
    });
  }

  for (const c of record.certificates ?? []) {
    const url = asUrl(c);
    push({
      sourceType: 'supplier',
      artifactType: 'document',
      purpose: 'compliance',
      externalUrl: url,
      rightsStatus: rights,
      raw: { field: 'certificates', value: c },
    });
  }

  for (const item of [...(record.media ?? []), ...(record.attachments ?? [])]) {
    const url = asUrl(item.url ?? item.href ?? item.src);
    const kind = String(item.type ?? item.kind ?? item.mimeType ?? '').toLowerCase();
    let artifactType: DiscoveredSupplierArtifact['artifactType'] = 'other';
    if (kind.includes('image') || kind.includes('jpg') || kind.includes('png')) artifactType = 'image';
    else if (kind.includes('video')) artifactType = 'video';
    else if (kind.includes('pdf') || kind.includes('doc')) artifactType = 'document';
    else if (kind.includes('gltf') || kind.includes('glb') || kind.includes('3d')) artifactType = 'model_3d';
    else if (url?.match(/\.(png|jpe?g|webp|gif)(\?|$)/i)) artifactType = 'image';
    else if (url?.match(/\.(mp4|webm|mov)(\?|$)/i)) artifactType = 'video';
    else if (url?.match(/\.(pdf|txt|docx?)(\?|$)/i)) artifactType = 'document';
    else if (url?.match(/\.(glb|gltf)(\?|$)/i)) artifactType = 'model_3d';

    push({
      sourceType: 'supplier',
      artifactType,
      purpose: purposeFromDocType(String(item.purpose ?? item.type ?? '')),
      externalUrl: url,
      title: typeof item.title === 'string' ? item.title : undefined,
      filename: typeof item.filename === 'string' ? item.filename : undefined,
      rightsStatus: rights,
      raw: { field: 'media_or_attachments', value: item },
    });
  }

  return out;
}

/** Parse a minimal CSV row with media URL columns into a discovery record. */
export function discoverFromCsvMediaRow(row: Record<string, string>): DiscoveredSupplierArtifact[] {
  return discoverSupplierArtifacts({
    title: row.title || row.name,
    imageUrl: row.image_url || row.image || row.primary_image,
    images: [row.image_2, row.image_3, row.additional_image].filter(Boolean) as string[],
    videoUrl: row.video_url || row.video,
    manuals: row.manual_url ? [row.manual_url] : [],
    documents: row.spec_url
      ? [{ url: row.spec_url, type: 'specification', title: 'Specification' }]
      : [],
  });
}
