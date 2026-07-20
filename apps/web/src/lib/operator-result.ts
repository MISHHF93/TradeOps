/**
 * Typed OperatorResult — frontend normalization of API operator/run responses.
 * Prefer semantic fields over raw model Markdown.
 */

import { resolveBriefingText } from './ai-briefing-provenance';
import type { OperatorRunResult } from './ai-operator-client';

export type OperatorDecisionOutcome =
  | 'recommend'
  | 'review'
  | 'block'
  | 'accept'
  | 'no_result'
  | 'unknown';

export type OperatorDataMode =
  | 'live'
  | 'cached'
  | 'sandbox'
  | 'fixture'
  | 'mixed'
  | 'simulation'
  | 'unavailable'
  | 'unknown';

export type OperatorRecommendation = {
  rank: number;
  title: string;
  rationale: string;
  confidence: number;
  productId?: string;
  nextActions: string[];
  isFixture?: boolean;
  priceBand?: string;
  risk?: string;
  sourceUrl?: string;
};

export type OperatorSource = {
  name: string;
  status?: string;
  detail?: string;
};

export type MerchantDecisionView = {
  headline: string;
  summary: string;
  topPick?: {
    rank: number;
    product: string;
    priceBand?: string | null;
    why?: string;
    risk?: string | null;
  };
  runnersUp: Array<{ rank: number; product: string; priceBand?: string | null }>;
  nextSteps: string[];
};

export type ListingBriefView = {
  product: string;
  listingTitle: string;
  bullets: string[];
  wholesaleBand?: string | null;
  suggestedRetail?: string;
  risk?: string | null;
  channelNote?: string;
  status?: string;
};

export type OperatorResultView = {
  runId?: string;
  status: string;
  objectiveText?: string;
  decision: {
    outcome: OperatorDecisionOutcome;
    headline: string;
    summary: string;
    confidence?: number;
  };
  recommendations: OperatorRecommendation[];
  sources: OperatorSource[];
  evidenceCount: number;
  riskCount: number;
  tools: string[];
  dataMode: OperatorDataMode;
  briefingSource?: string;
  fullResultHref: string;
  /** Short plain text for dock (Markdown markers stripped). */
  narrativePlain: string;
  approvalRequired: boolean;
  /** Cycle 7 */
  merchantDecision?: MerchantDecisionView;
  listingBrief?: ListingBriefView;
};

/** Strip common Markdown chrome so the dock never shows raw ** / ## */
export function stripMarkdownChrome(input: string): string {
  return input
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function asRec(raw: unknown, index: number): OperatorRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = String(r.title ?? r.name ?? '').trim();
  if (!title) return null;
  // Never surface tool dumps, fixture rows, or blog listicles as product cards
  if (/^[\w-]+\.[\w.-]+$/.test(title)) return null;
  if (/^(commerce|procurement|payments|logistics|analytics|research|search)\./i.test(title)) {
    return null;
  }
  if (
    /\b(how to|guide to|sites you can trust|process for finding|products to sell online in \d{4}|high-demand and trending|review sites)\b/i.test(
      title,
    ) ||
    title.length > 95
  ) {
    return null;
  }
  const rationale = String(r.rationale ?? r.reason ?? r.description ?? '').slice(0, 500);
  if (/fixture|demo catalog|test_fixture/i.test(title + rationale)) return null;
  if (/^\s*[\[{]/.test(rationale) || /"productId"\s*:/.test(rationale)) return null;
  const conf =
    typeof r.confidence === 'number'
      ? r.confidence
      : typeof r.score === 'number'
        ? r.score > 1
          ? r.score / 100
          : r.score
        : 0.5;
  const next = Array.isArray(r.nextActions)
    ? (r.nextActions as unknown[]).map(String)
    : ['research_further'];
  const evidenceObj = r.evidence as
    | { isFixtureSource?: boolean; sourceUrl?: string }
    | undefined;
  if (evidenceObj?.isFixtureSource) return null;
  const priceBand = r.priceBand
    ? String(r.priceBand)
    : rationale.match(/\$\s?[\d.,]+\s*[-–—to]+\s*\$?\s*[\d.,]+|\$\s?[\d.,]+/i)?.[0];
  return {
    rank: typeof r.rank === 'number' ? r.rank : index + 1,
    title: title.slice(0, 200),
    rationale,
    confidence: Math.max(0, Math.min(1, conf)),
    productId: r.productId ? String(r.productId) : undefined,
    nextActions: next.slice(0, 4),
    isFixture: false,
    priceBand: priceBand?.slice(0, 40),
    risk: r.risk ? String(r.risk).slice(0, 120) : undefined,
    sourceUrl: evidenceObj?.sourceUrl
      ? String(evidenceObj.sourceUrl)
      : r.sourceUrl
        ? String(r.sourceUrl)
        : undefined,
  };
}

function mapDecision(raw?: string | null): OperatorDecisionOutcome {
  const d = (raw ?? '').toLowerCase();
  if (d === 'accept' || d === 'recommend') return 'recommend';
  if (d === 'block') return 'block';
  if (d === 'review' || d === 'shadow') return 'review';
  if (!d) return 'unknown';
  return 'unknown';
}

function mapDataMode(result: OperatorRunResult): OperatorDataMode {
  const m = (
    result.honesty?.dataMode ||
    result.envelope?.meta?.dataMode ||
    ''
  ).toLowerCase();
  if (
    m === 'live' ||
    m === 'cached' ||
    m === 'sandbox' ||
    m === 'fixture' ||
    m === 'mixed' ||
    m === 'simulation' ||
    m === 'unavailable'
  ) {
    return m;
  }
  return 'unknown';
}

/**
 * Normalize a raw operator HTTP/SSE result into a dock-friendly view model.
 */
export function normalizeOperatorResult(
  result: OperatorRunResult,
  fallbackRunId?: string | null,
): OperatorResultView {
  const recs = (Array.isArray(result.recommendations) ? result.recommendations : [])
    .map((r, i) => asRec(r, i))
    .filter((r): r is OperatorRecommendation => Boolean(r));

  const sourcesRaw = (result as { sources?: unknown }).sources;
  const sources: OperatorSource[] = [];
  if (Array.isArray(sourcesRaw)) {
    for (const s of sourcesRaw) {
      if (!s || typeof s !== 'object') continue;
      const o = s as Record<string, unknown>;
      sources.push({
        name: String(o.name ?? o.provider ?? 'source'),
        status: o.status ? String(o.status) : undefined,
        detail: o.detail ? String(o.detail) : o.uri ? String(o.uri) : undefined,
      });
    }
  }

  const narrative =
    resolveBriefingText(result) ||
    (recs[0] ? `${recs[0].title}: ${recs[0].rationale}` : '') ||
    'Run completed.';

  const plain = stripMarkdownChrome(narrative);
  const headline =
    plain.split(/[.!?\n]/).map((s) => s.trim()).find(Boolean)?.slice(0, 140) ||
    (result.status === 'completed' ? 'Ready' : result.status || 'Result');

  const tools = Array.isArray(result.toolTrace)
    ? result.toolTrace
        .map((t) => {
          if (!t || typeof t !== 'object') return '';
          return String((t as { tool?: string }).tool ?? '');
        })
        .filter(Boolean)
    : [];

  const runId = result.runId || fallbackRunId || undefined;
  const fullResultHref =
    result.resultsPath ||
    (runId ? `/terminal/objectives/${runId}` : '/terminal/objectives');

  // Risk count: from honesty or structured field if present
  const risks = (result as { risks?: unknown }).risks;
  const riskCount = Array.isArray(risks) ? risks.length : 0;

  const md = result.merchantDecision;
  const merchantDecision: MerchantDecisionView | undefined =
    md && typeof md === 'object' && md.headline
      ? {
          headline: String(md.headline).slice(0, 160),
          summary: String(md.summary ?? '').slice(0, 400),
          topPick: md.topPick
            ? {
                rank: Number(md.topPick.rank ?? 1),
                product: String(md.topPick.product ?? ''),
                priceBand: md.topPick.priceBand,
                why: md.topPick.why ? String(md.topPick.why) : undefined,
                risk: md.topPick.risk,
              }
            : undefined,
          runnersUp: Array.isArray(md.runnersUp)
            ? md.runnersUp.slice(0, 3).map((r, i) => ({
                rank: Number(r.rank ?? i + 2),
                product: String(r.product ?? ''),
                priceBand: r.priceBand,
              }))
            : [],
          nextSteps: Array.isArray(md.nextSteps)
            ? md.nextSteps.map(String).slice(0, 5)
            : [],
        }
      : undefined;

  const lb = result.listingBrief;
  const listingBrief: ListingBriefView | undefined =
    lb && typeof lb === 'object' && (lb.product || lb.listingTitle)
      ? {
          product: String(lb.product ?? lb.listingTitle ?? ''),
          listingTitle: String(lb.listingTitle ?? lb.product ?? '').slice(0, 120),
          bullets: Array.isArray(lb.bullets)
            ? lb.bullets.map(String).slice(0, 6)
            : [],
          wholesaleBand: lb.wholesaleBand,
          suggestedRetail: lb.suggestedRetail
            ? String(lb.suggestedRetail)
            : undefined,
          risk: lb.risk ? String(lb.risk) : undefined,
          channelNote: lb.channelNote ? String(lb.channelNote) : undefined,
          status: lb.status ? String(lb.status) : undefined,
        }
      : undefined;

  const decisionHeadline =
    merchantDecision?.headline?.trim() ||
    headline;
  const decisionSummary =
    merchantDecision?.summary?.trim() ||
    plain.slice(0, 600);

  return {
    runId,
    status: result.status || 'unknown',
    decision: {
      outcome: mapDecision(result.decision) === 'unknown' && merchantDecision
        ? 'recommend'
        : mapDecision(result.decision),
      headline: decisionHeadline,
      summary: decisionSummary,
      confidence: merchantDecision?.topPick
        ? recs[0]?.confidence
        : recs[0]?.confidence,
    },
    recommendations: recs,
    sources,
    evidenceCount: sources.length,
    riskCount,
    tools,
    dataMode: mapDataMode(result),
    briefingSource: result.briefingSource,
    fullResultHref,
    narrativePlain: plain,
    approvalRequired: Boolean(result.approvalRequired),
    merchantDecision,
    listingBrief,
  };
}
