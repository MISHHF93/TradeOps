/**
 * Multimodal product understanding — rule-based proposals + optional xAI Grok enrichment.
 * All outputs are labeled proposals (not ground truth). Human review required.
 */

export type ArtifactAnalysisProposal = {
  proposal: true;
  humanReviewRequired: true;
  sourceArtifactId: string;
  model: string;
  confidence: number;
  artifactType: string;
  analysis: Record<string, unknown>;
  extractedAt: string;
};

export function analyzeArtifactContent(input: {
  artifactId: string;
  artifactType: string;
  purpose: string;
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  pageCount?: number | null;
  bodyTextSample?: string | null;
  sourcePlatform?: string | null;
}): ArtifactAnalysisProposal {
  const title = (input.title ?? '').toLowerCase();
  const sample = (input.bodyTextSample ?? input.description ?? input.altText ?? '').toLowerCase();
  const blob = `${title} ${sample} ${input.purpose}`;

  if (input.artifactType === 'image') {
    const minDim = Math.min(input.width ?? 0, input.height ?? 0);
    const quality =
      minDim >= 1000 ? 85 : minDim >= 500 ? 70 : minDim > 0 ? 40 : 20;
    return {
      proposal: true,
      humanReviewRequired: true,
      sourceArtifactId: input.artifactId,
      model: 'tradeops-rule-multimodal-v1',
      confidence: 0.45,
      artifactType: 'image',
      extractedAt: new Date().toISOString(),
      analysis: {
        visibleProductType: guessProductType(blob),
        color: guessColor(blob),
        packaging: /pack|box|carton/.test(blob) || input.purpose === 'packaging',
        apparentDimensions: input.width && input.height ? `${input.width}×${input.height}` : null,
        visibleText: Boolean(input.altText || input.title),
        variantClues: /variant|color|size|sku/.test(blob),
        usageContext: input.purpose,
        qualityConcerns:
          minDim > 0 && minDim < 500 ? ['Below 500×500 channel guidance'] : [],
        imageQualityScore: quality,
        listingSuitability: minDim >= 500 && input.purpose !== 'other' ? 'candidate' : 'review',
        possibleDuplicateIndication: false,
        note: 'Rule-based proposal — not vision LLM ground truth',
      },
    };
  }

  if (input.artifactType === 'video' || input.artifactType === 'external_video') {
    const dur = input.durationSeconds ?? null;
    return {
      proposal: true,
      humanReviewRequired: true,
      sourceArtifactId: input.artifactId,
      model: 'tradeops-rule-multimodal-v1',
      confidence: 0.35,
      artifactType: input.artifactType,
      extractedAt: new Date().toISOString(),
      analysis: {
        productDemonstrated: guessProductType(blob),
        useCase: input.purpose === 'installation' ? 'installation' : 'demonstration',
        visibleSteps: null,
        visibleDefects: null,
        durationSuitability:
          dur == null ? 'unknown' : dur >= 15 && dur <= 180 ? 'good' : 'review',
        listingSuitability: 'review',
        possiblePolicyConcern: /weapon|firearm|knife|drug/.test(blob),
        note: 'External video slots may not have downloaded bytes yet',
      },
    };
  }

  if (input.artifactType === 'document') {
    return {
      proposal: true,
      humanReviewRequired: true,
      sourceArtifactId: input.artifactId,
      model: 'tradeops-rule-multimodal-v1',
      confidence: 0.5,
      artifactType: 'document',
      extractedAt: new Date().toISOString(),
      analysis: {
        documentType: classifyDoc(input.purpose, blob),
        productIdentity: input.title ?? null,
        specifications: /spec|dimension|material|weight/.test(blob),
        warnings: /warn|caution|danger|hazard/.test(blob),
        warrantyTerms: /warrant|guarantee/.test(blob),
        certificationReferences: /iso|ce |ul |fcc|certificate/.test(blob),
        language: 'en',
        effectiveDate: null,
        expiryDate: null,
        conflictingInformation: false,
        pageCount: input.pageCount ?? null,
        note: 'Text heuristics only — PDF OCR not applied in rule model',
      },
    };
  }

  if (input.artifactType === 'model_3d') {
    return {
      proposal: true,
      humanReviewRequired: true,
      sourceArtifactId: input.artifactId,
      model: 'tradeops-rule-multimodal-v1',
      confidence: 0.3,
      artifactType: 'model_3d',
      extractedAt: new Date().toISOString(),
      analysis: {
        formatValid: true,
        browserDisplay: 'graceful_fallback_when_unsupported',
        geometryMetadata: null,
        materialMetadata: null,
        posterRecommended: true,
      },
    };
  }

  return {
    proposal: true,
    humanReviewRequired: true,
    sourceArtifactId: input.artifactId,
    model: 'tradeops-rule-multimodal-v1',
    confidence: 0.2,
    artifactType: input.artifactType,
    extractedAt: new Date().toISOString(),
    analysis: { note: 'No specialized analyzer for this artifact type yet' },
  };
}

function guessProductType(blob: string): string {
  if (/bottle|water/.test(blob)) return 'bottle';
  if (/mat|yoga/.test(blob)) return 'yoga_mat';
  if (/led|light|strip/.test(blob)) return 'lighting';
  if (/desk|organizer|bamboo/.test(blob)) return 'desk_organizer';
  if (/holster|weapon|tactical/.test(blob)) return 'restricted_accessory';
  return 'general_product';
}

function guessColor(blob: string): string | null {
  for (const c of ['black', 'white', 'silver', 'blue', 'red', 'green', 'bamboo', 'natural']) {
    if (blob.includes(c)) return c;
  }
  return null;
}

function classifyDoc(purpose: string, blob: string): string {
  if (purpose === 'manual' || /manual|install/.test(blob)) return 'user_manual';
  if (purpose === 'specification' || /specification|spec sheet/.test(blob)) return 'specification_sheet';
  if (purpose === 'warranty' || /warrant/.test(blob)) return 'warranty';
  if (purpose === 'compliance' || /certif|compliance|safety/.test(blob)) return 'compliance_certificate';
  return purpose || 'document';
}

/**
 * Full analysis: rules first, optional xAI enrichment for purpose + content narrative.
 */
export async function analyzeArtifactWithAi(input: {
  artifactId: string;
  artifactType: string;
  purpose: string;
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  pageCount?: number | null;
  bodyTextSample?: string | null;
  sourcePlatform?: string | null;
  useXai?: boolean;
}): Promise<{
  content: ArtifactAnalysisProposal;
  purpose: Awaited<
    ReturnType<typeof import('@tradeops/ai-runtime').classifyArtifactPurpose>
  >;
  hybrid: boolean;
}> {
  const content = analyzeArtifactContent(input);
  const { classifyArtifactPurpose, enrichClassificationWithXai } =
    await import('@tradeops/ai-runtime');

  let purpose = await classifyArtifactPurpose({
    title: input.title,
    altText: input.altText,
    description: input.description,
    purpose: input.purpose,
    mimeType: input.mimeType,
    artifactType: input.artifactType,
    useXai: input.useXai,
  });

  let hybrid = purpose.source === 'hybrid' || purpose.source === 'xai';

  // Optionally enrich content analysis narrative via xAI (text only — not vision)
  if (input.useXai !== false) {
    try {
      const contentAsProposal = {
        proposal: true as const,
        humanReviewRequired: true as const,
        kind: 'artifact_content' as const,
        model: content.model,
        confidence: content.confidence,
        labels: {
          artifactType: content.artifactType,
        },
        analysis: content.analysis,
        extractedAt: content.extractedAt,
        source: 'rules' as const,
      };
      const enriched = await enrichClassificationWithXai({
        kind: 'artifact_content',
        rules: contentAsProposal,
        context: JSON.stringify({
          artifact: input,
          ruleAnalysis: content.analysis,
        }),
        systemExtra:
          'Enrich listing suitability, quality notes, and policy concerns. Keep proposal:true. Do not claim OCR of images you cannot see.',
      });
      if (enriched.source === 'hybrid') {
        hybrid = true;
        // Merge xAI analysis into content proposal
        (content as ArtifactAnalysisProposal).model = `${content.model}+${enriched.model}`;
        (content as ArtifactAnalysisProposal).confidence = Math.max(
          content.confidence,
          enriched.confidence,
        );
        (content as ArtifactAnalysisProposal).analysis = {
          ...content.analysis,
          xaiEnrichment: enriched.analysis,
          xaiLabels: enriched.labels,
        };
      }
    } catch {
      // keep rules-only content
    }
  }

  return { content, purpose, hybrid };
}
