export type CommerceSignalType =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'SCALE'
  | 'REDUCE'
  | 'EXIT'
  | 'BLOCKED';

export type SignalDecision = {
  signal: CommerceSignalType;
  rationale: string;
  confidence: number;
};

/**
 * Map score + policy + listing state → commerce signal.
 */
export function decideSignal(input: {
  opportunityScore: number;
  policyOutcome: 'approved' | 'approved_with_conditions' | 'manual_review' | 'blocked';
  netMarginBps: number;
  hasActiveListing: boolean;
  forecastConfidence: number;
  dataConfidence: number;
}): SignalDecision {
  if (input.policyOutcome === 'blocked') {
    return {
      signal: 'BLOCKED',
      rationale: 'Policy engine blocked this product. Do not source or list.',
      confidence: 0.95,
    };
  }

  if (input.policyOutcome === 'manual_review') {
    return {
      signal: 'HOLD',
      rationale: 'Policy requires manual review before any listing or procurement action.',
      confidence: 0.7,
    };
  }

  const conf = Math.min(input.forecastConfidence, input.dataConfidence);
  const score = input.opportunityScore;
  const marginOk = input.netMarginBps >= 1200;

  if (!input.hasActiveListing) {
    if (score >= 72 && marginOk) {
      return {
        signal: 'BUY',
        rationale: `Strong opportunity score (${score}) with acceptable unit margin (${input.netMarginBps} bps). Consider sourcing; listing still requires approval.`,
        confidence: conf,
      };
    }
    if (score >= 55) {
      return {
        signal: 'HOLD',
        rationale: `Moderate score (${score}). Observe; do not increase capital commitment yet.`,
        confidence: conf,
      };
    }
    return {
      signal: 'EXIT',
      rationale: `Weak score (${score}). Do not onboard this product.`,
      confidence: conf,
    };
  }

  // Has listing
  if (score >= 80 && marginOk) {
    return {
      signal: 'SCALE',
      rationale: `Listed product performing well on score (${score}). Consider controlled scale after approval.`,
      confidence: conf,
    };
  }
  if (score >= 72 && marginOk) {
    return {
      signal: 'SELL',
      rationale: `Listed product remains suitable to sell/promote (score ${score}).`,
      confidence: conf,
    };
  }
  if (score >= 55) {
    return {
      signal: 'HOLD',
      rationale: `Maintain listing; avoid increasing exposure (score ${score}).`,
      confidence: conf,
    };
  }
  if (score >= 40) {
    return {
      signal: 'REDUCE',
      rationale: `Weakening economics (score ${score}). Reduce ads/exposure.`,
      confidence: conf,
    };
  }
  return {
    signal: 'EXIT',
    rationale: `Poor score (${score}). Pause or remove listing after approval.`,
    confidence: conf,
  };
}
