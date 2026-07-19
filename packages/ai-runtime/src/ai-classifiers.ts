/**
 * AI classification helpers — rules first, optional xAI Grok enrichment.
 * Every LLM output is a proposal (humanReviewRequired). Rules still fail-closed on policy blocks.
 */

import { completeWithXai, shouldUseXai } from './llm-client';

export type ClassifierKind =
  | 'artifact_content'
  | 'artifact_purpose'
  | 'product_category'
  | 'policy_second_opinion'
  | 'objective_intent'
  | 'listing_quality';

export type ClassificationProposal<T = Record<string, unknown>> = {
  proposal: true;
  humanReviewRequired: true;
  kind: ClassifierKind;
  model: string;
  confidence: number;
  labels: Record<string, string | number | boolean | null>;
  analysis: T;
  extractedAt: string;
  source: 'rules' | 'xai' | 'hybrid';
};

const ARTIFACT_PURPOSES = [
  'primary',
  'gallery',
  'lifestyle',
  'variant',
  'packaging',
  'dimensions',
  'installation',
  'demonstration',
  'manual',
  'specification',
  'warranty',
  'compliance',
  'regulatory',
  'marketing',
  'supplier_evidence',
  'other',
] as const;

const ARTIFACT_TYPES = [
  'image',
  'video',
  'external_video',
  'document',
  'model_3d',
  'spin_set',
  'structured_data',
  'generated_asset',
  'other',
] as const;

/** Rule-based purpose suggestion from text/mime. */
export function classifyArtifactPurposeRules(input: {
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  purpose?: string | null;
  mimeType?: string | null;
  artifactType?: string | null;
}): ClassificationProposal {
  const blob = `${input.title ?? ''} ${input.altText ?? ''} ${input.description ?? ''} ${input.purpose ?? ''}`.toLowerCase();
  let purpose: string = input.purpose && input.purpose !== 'other' ? input.purpose : 'other';
  let confidence = 0.4;

  if (/manual|install|instruction|guide/.test(blob)) {
    purpose = 'manual';
    confidence = 0.75;
  } else if (/warrant|guarantee/.test(blob)) {
    purpose = 'warranty';
    confidence = 0.75;
  } else if (/spec\b|datasheet|specification/.test(blob)) {
    purpose = 'specification';
    confidence = 0.7;
  } else if (/certif|compliance|ce mark|fcc|ul listed/.test(blob)) {
    purpose = 'compliance';
    confidence = 0.7;
  } else if (/packag|box|carton|unbox/.test(blob)) {
    purpose = 'packaging';
    confidence = 0.65;
  } else if (/dimension|size chart|measurement/.test(blob)) {
    purpose = 'dimensions';
    confidence = 0.65;
  } else if (/lifestyle|in use|in-situ/.test(blob)) {
    purpose = 'lifestyle';
    confidence = 0.6;
  } else if (/demo|demonstrat|how to/.test(blob)) {
    purpose = 'demonstration';
    confidence = 0.65;
  } else if (/primary|hero|main image|cover/.test(blob)) {
    purpose = 'primary';
    confidence = 0.7;
  } else if (/gallery|angle|side view|back view/.test(blob)) {
    purpose = 'gallery';
    confidence = 0.6;
  } else if (input.mimeType?.startsWith('video/')) {
    purpose = 'demonstration';
    confidence = 0.45;
  }

  let artifactType = input.artifactType ?? 'other';
  if (input.mimeType?.startsWith('image/')) artifactType = 'image';
  else if (input.mimeType?.startsWith('video/')) artifactType = 'video';
  else if (input.mimeType === 'application/pdf' || /pdf|document/.test(blob))
    artifactType = 'document';

  return {
    proposal: true,
    humanReviewRequired: true,
    kind: 'artifact_purpose',
    model: 'tradeops-rule-classifier-v1',
    confidence,
    labels: {
      suggestedPurpose: purpose,
      suggestedArtifactType: artifactType,
      allowedPurposes: ARTIFACT_PURPOSES.join(','),
      allowedTypes: ARTIFACT_TYPES.join(','),
    },
    analysis: {
      note: 'Rule-based labels only — not LLM ground truth',
      matchedFromText: purpose !== 'other',
    },
    extractedAt: new Date().toISOString(),
    source: 'rules',
  };
}

export function classifyProductCategoryRules(input: {
  title: string;
  description?: string;
  category?: string;
}): ClassificationProposal {
  const blob = `${input.title} ${input.description ?? ''} ${input.category ?? ''}`.toLowerCase();
  let category = input.category?.trim() || 'General';
  let confidence = input.category ? 0.55 : 0.35;

  const map: Array<[RegExp, string, number]> = [
    [/water bottle|tumbler|flask/, 'Home & Kitchen', 0.7],
    [/yoga|fitness|mat|resistance/, 'Sports & Outdoors', 0.7],
    [/led|light|lamp|strip/, 'Home Improvement', 0.65],
    [/earbud|headphone|bluetooth|wireless audio/, 'Electronics', 0.75],
    [/desk|organizer|office/, 'Office Products', 0.65],
    [/pet |dog |cat /, 'Pet Supplies', 0.7],
    [/beauty|skincare|cosmetic/, 'Beauty', 0.7],
    [/toy|kids|children/, 'Toys & Games', 0.65],
  ];
  for (const [re, cat, conf] of map) {
    if (re.test(blob)) {
      category = cat;
      confidence = conf;
      break;
    }
  }

  return {
    proposal: true,
    humanReviewRequired: true,
    kind: 'product_category',
    model: 'tradeops-rule-classifier-v1',
    confidence,
    labels: { suggestedCategory: category },
    analysis: { note: 'Rule taxonomy proposal' },
    extractedAt: new Date().toISOString(),
    source: 'rules',
  };
}

export function classifyObjectiveIntentRules(objective: string): ClassificationProposal {
  const o = objective.toLowerCase();
  let intent = 'research';
  let confidence = 0.5;
  if (/publish|list on|go live/.test(o)) {
    intent = 'publish';
    confidence = 0.8;
  } else if (/draft listing|prepare listing|create listing/.test(o)) {
    intent = 'draft_listing';
    confidence = 0.75;
  } else if (/purchase|buy inventory|supplier po|procure/.test(o)) {
    intent = 'procurement';
    confidence = 0.75;
  } else if (/forecast|predict|demand/.test(o)) {
    intent = 'forecast';
    confidence = 0.7;
  } else if (/approv|review queue/.test(o)) {
    intent = 'approvals';
    confidence = 0.7;
  } else if (/find|search|scan|opportunit|evaluat|margin/.test(o)) {
    intent = 'research';
    confidence = 0.7;
  }

  return {
    proposal: true,
    humanReviewRequired: true,
    kind: 'objective_intent',
    model: 'tradeops-rule-classifier-v1',
    confidence,
    labels: { intent, approvalLikely: intent === 'publish' || intent === 'procurement' },
    analysis: { note: 'Maps to operator objective types' },
    extractedAt: new Date().toISOString(),
    source: 'rules',
  };
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Optional xAI enrichment — merges over rule proposal; never removes proposal flags.
 */
export async function enrichClassificationWithXai(input: {
  kind: ClassifierKind;
  rules: ClassificationProposal;
  context: string;
  systemExtra?: string;
}): Promise<ClassificationProposal> {
  if (!shouldUseXai()) {
    return input.rules;
  }

  const llm = await completeWithXai({
    system: [
      'You are a TradeOps commerce classifier. Return ONLY a single JSON object.',
      'All outputs are proposals requiring human review. Never claim ground truth.',
      'Never invent live marketplace data or connector success.',
      'Label fixtures if mentioned. Revenue is never profit.',
      input.systemExtra ?? '',
    ]
      .filter(Boolean)
      .join(' '),
    user: [
      `Classifier kind: ${input.kind}`,
      `Rule baseline JSON: ${JSON.stringify(input.rules)}`,
      `Context:\n${input.context.slice(0, 3500)}`,
      '',
      'Return JSON with keys: confidence (0-1), labels (object), analysis (object), rationale (string).',
    ].join('\n'),
    temperature: 0.15,
    maxTokens: 800,
  });

  if (!llm.ok || !llm.text) {
    return {
      ...input.rules,
      analysis: {
        ...input.rules.analysis,
        xaiError: llm.error ?? 'no response',
      },
    };
  }

  const parsed = extractJsonObject(llm.text);
  if (!parsed) {
    return {
      ...input.rules,
      analysis: {
        ...input.rules.analysis,
        xaiRaw: llm.text.slice(0, 500),
        xaiParseError: true,
      },
      source: 'hybrid',
      model: llm.model ?? 'xai',
    };
  }

  const conf =
    typeof parsed.confidence === 'number'
      ? Math.min(0.92, Math.max(0.1, parsed.confidence))
      : Math.min(0.85, input.rules.confidence + 0.15);

  const labels = {
    ...input.rules.labels,
    ...(typeof parsed.labels === 'object' && parsed.labels
      ? (parsed.labels as Record<string, string | number | boolean | null>)
      : {}),
  };

  return {
    proposal: true,
    humanReviewRequired: true,
    kind: input.kind,
    model: llm.model ?? 'grok-4.5',
    confidence: conf,
    labels,
    analysis: {
      rulesBaseline: input.rules.analysis,
      xai: typeof parsed.analysis === 'object' ? parsed.analysis : parsed,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : null,
    },
    extractedAt: new Date().toISOString(),
    source: 'hybrid',
  };
}

/** Convenience: purpose classification with optional Grok. */
export async function classifyArtifactPurpose(input: {
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  purpose?: string | null;
  mimeType?: string | null;
  artifactType?: string | null;
  useXai?: boolean;
}): Promise<ClassificationProposal> {
  const rules = classifyArtifactPurposeRules(input);
  if (input.useXai === false || !shouldUseXai()) return rules;
  return enrichClassificationWithXai({
    kind: 'artifact_purpose',
    rules,
    context: JSON.stringify(input),
    systemExtra: `Suggest purpose from: ${ARTIFACT_PURPOSES.join(', ')}. Suggest type from: ${ARTIFACT_TYPES.join(', ')}.`,
  });
}

export async function classifyProductCategory(input: {
  title: string;
  description?: string;
  category?: string;
  useXai?: boolean;
}): Promise<ClassificationProposal> {
  const rules = classifyProductCategoryRules(input);
  if (input.useXai === false || !shouldUseXai()) return rules;
  return enrichClassificationWithXai({
    kind: 'product_category',
    rules,
    context: `Title: ${input.title}\nDescription: ${input.description ?? ''}\nCurrent category: ${input.category ?? ''}`,
    systemExtra: 'Suggest a marketplace-style category string and optional subcategory.',
  });
}

export async function classifyObjectiveIntent(
  objective: string,
  useXai = true,
): Promise<ClassificationProposal> {
  const rules = classifyObjectiveIntentRules(objective);
  if (!useXai || !shouldUseXai()) return rules;
  return enrichClassificationWithXai({
    kind: 'objective_intent',
    rules,
    context: objective,
    systemExtra:
      'intent one of: research, draft_listing, publish, procurement, forecast, approvals, other. approvalLikely boolean.',
  });
}

