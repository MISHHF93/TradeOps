/**
 * CSV export helpers for RAG corpus / ProductArtifact capture.
 * Pure functions — no filesystem side effects.
 */

export type ArtifactCorpusRow = {
  organizationId: string;
  artifactId: string;
  productId: string;
  productTitle: string;
  artifactType: string;
  purpose: string;
  sourceType: string;
  sourcePlatform: string;
  title: string;
  altText: string;
  description: string;
  mimeType: string;
  filename: string;
  storageKey: string;
  externalUrl: string;
  rightsStatus: string;
  publicationStatus: string;
  visibility: string;
  qualityScore: string;
  completenessScore: string;
  confidence: string;
  isFixture: string;
  collectedAt: string;
  textForRag: string;
  dataClass: 'fixture' | 'canonical' | 'live';
};

export const ARTIFACT_CORPUS_HEADERS: (keyof ArtifactCorpusRow)[] = [
  'organizationId',
  'artifactId',
  'productId',
  'productTitle',
  'artifactType',
  'purpose',
  'sourceType',
  'sourcePlatform',
  'title',
  'altText',
  'description',
  'mimeType',
  'filename',
  'storageKey',
  'externalUrl',
  'rightsStatus',
  'publicationStatus',
  'visibility',
  'qualityScore',
  'completenessScore',
  'confidence',
  'isFixture',
  'collectedAt',
  'textForRag',
  'dataClass',
];

export function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: Array<Record<string, string | number | null | undefined>>,
): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

export function buildArtifactTextForRag(input: {
  productTitle?: string | null;
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  artifactType?: string | null;
  purpose?: string | null;
  mimeType?: string | null;
  rightsStatus?: string | null;
  publicationStatus?: string | null;
}): string {
  return [
    input.productTitle ? `Product: ${input.productTitle}` : '',
    input.title ? `Artifact title: ${input.title}` : '',
    input.altText ? `Alt: ${input.altText}` : '',
    input.description ? `Description: ${input.description}` : '',
    input.artifactType ? `Type: ${input.artifactType}` : '',
    input.purpose ? `Purpose: ${input.purpose}` : '',
    input.mimeType ? `MIME: ${input.mimeType}` : '',
    input.rightsStatus ? `Rights: ${input.rightsStatus}` : '',
    input.publicationStatus ? `Publication: ${input.publicationStatus}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function classifyArtifactDataClass(input: {
  isFixture?: boolean;
  sourcePlatform?: string | null;
  sourceType?: string | null;
  sourceProvenance?: string | null;
}): ArtifactCorpusRow['dataClass'] {
  if (
    input.isFixture ||
    (input.sourcePlatform ?? '').toLowerCase().includes('fixture') ||
    (input.sourceType ?? '') === 'generated'
  ) {
    return 'fixture';
  }
  if ((input.sourceProvenance ?? '').startsWith('live_http:')) {
    return 'live';
  }
  return 'canonical';
}

export function artifactToCorpusRow(input: {
  organizationId: string;
  artifactId: string;
  productId: string;
  productTitle?: string | null;
  artifactType: string;
  purpose: string;
  sourceType: string;
  sourcePlatform?: string | null;
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  storageKey?: string | null;
  externalUrl?: string | null;
  rightsStatus: string;
  publicationStatus: string;
  visibility: string;
  qualityScore?: number | null;
  completenessScore?: number | null;
  confidence?: number | null;
  isFixture?: boolean;
  collectedAt?: string | null;
  sourceProvenance?: string | null;
}): ArtifactCorpusRow {
  const dataClass = classifyArtifactDataClass({
    isFixture: input.isFixture,
    sourcePlatform: input.sourcePlatform,
    sourceType: input.sourceType,
    sourceProvenance: input.sourceProvenance,
  });
  const textForRag = buildArtifactTextForRag(input);
  return {
    organizationId: input.organizationId,
    artifactId: input.artifactId,
    productId: input.productId,
    productTitle: input.productTitle ?? '',
    artifactType: input.artifactType,
    purpose: input.purpose,
    sourceType: input.sourceType,
    sourcePlatform: input.sourcePlatform ?? '',
    title: input.title ?? '',
    altText: input.altText ?? '',
    description: input.description ?? '',
    mimeType: input.mimeType ?? '',
    filename: input.filename ?? '',
    storageKey: input.storageKey ?? '',
    externalUrl: input.externalUrl ?? '',
    rightsStatus: input.rightsStatus,
    publicationStatus: input.publicationStatus,
    visibility: input.visibility,
    qualityScore:
      input.qualityScore == null ? '' : String(input.qualityScore),
    completenessScore:
      input.completenessScore == null ? '' : String(input.completenessScore),
    confidence: input.confidence == null ? '' : String(input.confidence),
    isFixture: dataClass === 'fixture' ? 'true' : 'false',
    collectedAt: input.collectedAt ?? '',
    textForRag,
    dataClass,
  };
}

export function artifactCorpusToCsv(rows: ArtifactCorpusRow[]): string {
  return rowsToCsv(
    ARTIFACT_CORPUS_HEADERS as unknown as string[],
    rows as unknown as Array<Record<string, string>>,
  );
}
