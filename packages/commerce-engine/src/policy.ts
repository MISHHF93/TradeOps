export type PolicyOutcome = 'approved' | 'approved_with_conditions' | 'manual_review' | 'blocked';

export type PolicyAssessmentResult = {
  outcome: PolicyOutcome;
  reasons: string[];
  riskFlags: string[];
  failClosed: boolean;
};

const BLOCK_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b(weapon|firearm|ammunition|taser)\b/i, flag: 'weapons' },
  { re: /\b(nicotine|vape|e-?cigarette|tobacco)\b/i, flag: 'nicotine' },
  { re: /\b(cannabis|thc|controlled substance|opioid)\b/i, flag: 'controlled_substance' },
  { re: /\b(counterfeit|replica watches?|fake designer)\b/i, flag: 'counterfeit_risk' },
  { re: /\b(explosive|radioactive|hazardous chemical)\b/i, flag: 'hazardous' },
];

const REVIEW_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b(alcohol|wine|spirits|beer)\b/i, flag: 'alcohol' },
  { re: /\b(lithium|battery pack)\b/i, flag: 'battery' },
  { re: /\b(supplement|pharma|prescription)\b/i, flag: 'health_regulated' },
  { re: /\b(trademark|copyright|brand licensed)\b/i, flag: 'ip_review' },
];

/**
 * Fail-closed policy gate for listing/procurement.
 * High margin never overrides blocked outcomes (enforced by callers).
 */
export function assessProductPolicy(input: {
  title: string;
  description?: string;
  category?: string;
  certificationsPresent?: boolean;
}): PolicyAssessmentResult {
  const text = `${input.title} ${input.description ?? ''} ${input.category ?? ''}`;
  const reasons: string[] = [];
  const riskFlags: string[] = [];

  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(text)) {
      riskFlags.push(p.flag);
      reasons.push(`Blocked keyword/category match: ${p.flag}`);
    }
  }

  if (riskFlags.length > 0) {
    return {
      outcome: 'blocked',
      reasons,
      riskFlags,
      failClosed: true,
    };
  }

  for (const p of REVIEW_PATTERNS) {
    if (p.re.test(text)) {
      riskFlags.push(p.flag);
      reasons.push(`Manual review required: ${p.flag}`);
    }
  }

  if (riskFlags.includes('battery') && !input.certificationsPresent) {
    return {
      outcome: 'manual_review',
      reasons: [...reasons, 'Battery-related product without certification flag — fail closed to manual review'],
      riskFlags,
      failClosed: true,
    };
  }

  if (riskFlags.length > 0) {
    return {
      outcome: 'manual_review',
      reasons,
      riskFlags,
      failClosed: true,
    };
  }

  return {
    outcome: 'approved',
    reasons: ['No restricted keywords detected in v1 rule set'],
    riskFlags: [],
    failClosed: false,
  };
}
