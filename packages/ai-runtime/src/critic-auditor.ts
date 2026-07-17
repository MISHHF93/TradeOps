import type {
  AuditorResult,
  CriticResult,
  OperatorDecision,
  RecommendationDraft,
  ToolTraceEntry,
} from './types';

/**
 * Critic pass — search for faulty assumptions, stale data, missing costs, policy issues.
 */
export function runCriticPass(
  recommendations: RecommendationDraft[],
  toolTrace: ToolTraceEntry[],
): CriticResult {
  const issues: string[] = [];

  for (const t of toolTrace) {
    if (t.error) issues.push(`Tool ${t.tool} failed: ${t.error}`);
  }

  for (const r of recommendations) {
    if (r.missingData.length > 0) {
      issues.push(`Recommendation "${r.title}" missing data: ${r.missingData.join(', ')}`);
    }
    if (r.confidence < 0.45) {
      issues.push(`Low confidence (${r.confidence.toFixed(2)}) on "${r.title}"`);
    }
    if (r.policyRiskScore >= 70) {
      issues.push(`High policy risk (${r.policyRiskScore}) on "${r.title}"`);
    }
    const profit = Number((r.calculation as { contributionProfitMinor?: number }).contributionProfitMinor);
    if (Number.isFinite(profit) && profit < 0) {
      issues.push(`Negative contribution profit on "${r.title}"`);
    }
    const freshness = r.evidence.dataFreshnessAt as string | undefined;
    if (freshness) {
      const ageMs = Date.now() - new Date(freshness).getTime();
      if (ageMs > 7 * 24 * 3600 * 1000) {
        issues.push(`Stale data (>7d) for "${r.title}"`);
      }
    }
  }

  let severity: CriticResult['severity'] = 'none';
  if (issues.length > 0) severity = 'low';
  if (issues.some((i) => /policy|Negative|failed/i.test(i))) severity = 'medium';
  if (issues.some((i) => /High policy|prohibited/i.test(i))) severity = 'high';

  return {
    issues,
    severity,
    notes:
      issues.length === 0
        ? 'Critic found no blocking issues in recommendation set.'
        : `Critic flagged ${issues.length} issue(s).`,
  };
}

/**
 * Auditor pass — independently verify calculations, permissions, policy, workflow validity.
 */
export function runAuditorPass(
  recommendations: RecommendationDraft[],
  toolTrace: ToolTraceEntry[],
  opts?: { requiredPermissions?: string[]; heldPermissions?: string[] },
): AuditorResult {
  const issues: string[] = [];
  let calculationOk = true;
  let policyOk = true;
  let permissionsOk = true;
  let identityOk = true;

  for (const r of recommendations) {
    const calc = r.calculation as {
      revenueMinor?: number;
      contributionProfitMinor?: number;
      netMarginBps?: number;
    };
    if (calc.revenueMinor != null && calc.contributionProfitMinor != null) {
      if (calc.contributionProfitMinor > calc.revenueMinor) {
        calculationOk = false;
        issues.push(`Profit exceeds revenue for "${r.title}" — calculation invalid`);
      }
    }
    if (r.policyRiskScore >= 80 || r.actionClass === 'prohibited') {
      policyOk = false;
      issues.push(`Policy gate fails for "${r.title}"`);
    }
    if (r.evidence.isFixtureSource === true && r.actionClass === 'financial_contractual') {
      identityOk = false;
      issues.push(`Fixture-sourced product cannot receive financial live action: "${r.title}"`);
    }
  }

  if (opts?.requiredPermissions?.length) {
    for (const p of opts.requiredPermissions) {
      if (!opts.heldPermissions?.includes(p) && !opts.heldPermissions?.includes('*')) {
        permissionsOk = false;
        issues.push(`Missing permission ${p}`);
      }
    }
  }

  for (const t of toolTrace) {
    if (t.error) calculationOk = false;
  }

  return {
    calculationOk,
    policyOk,
    permissionsOk,
    identityOk,
    issues,
    notes:
      issues.length === 0
        ? 'Auditor verified calculations, policy, and identity constraints.'
        : `Auditor found ${issues.length} issue(s).`,
  };
}

export function decideFromPasses(
  critic: CriticResult,
  auditor: AuditorResult,
  recommendations: RecommendationDraft[],
  classification?: {
    objectiveType?: string;
    approvalRequired?: boolean;
    riskClass?: string;
  },
): { decision: OperatorDecision; note: string } {
  const isReadOnly =
    classification?.objectiveType === 'READ_ONLY_ANALYSIS' ||
    classification?.riskClass === 'read_only' ||
    (recommendations.length > 0 &&
      recommendations.every((r) => r.actionClass === 'read_only' && !r.approvalRequired));

  if (recommendations.length === 0) {
    return {
      decision: isReadOnly ? 'accept' : 'block',
      note: isReadOnly
        ? 'Analysis completed with zero qualifying products under current filters.'
        : 'No recommendations produced.',
    };
  }

  // Read-only analysis never escalates to approval
  if (isReadOnly) {
    if (critic.severity === 'high' && !auditor.policyOk) {
      return {
        decision: 'block',
        note: 'Analysis blocked: high policy severity on all candidates.',
      };
    }
    return {
      decision: 'accept',
      note: `Read-only analysis accepted: ${recommendations.length} recommendation(s). No approval required for research.`,
    };
  }

  if (!auditor.policyOk || critic.severity === 'high') {
    return {
      decision: 'block',
      note: 'Blocked by policy/critic high severity. No consequential execution.',
    };
  }
  if (!auditor.calculationOk || !auditor.identityOk) {
    return {
      decision: 'revise',
      note: 'Calculation or identity issues — revise before execution.',
    };
  }
  if (critic.severity === 'medium' || recommendations.some((r) => r.confidence < 0.5)) {
    return {
      decision: 'downgrade',
      note: 'Downgraded to shadow/approval-only due to medium risk or low confidence.',
    };
  }
  // Escalate only when consequential actions actually require approval
  if (
    classification?.approvalRequired ||
    recommendations.some((r) => r.approvalRequired && r.actionClass !== 'read_only')
  ) {
    return {
      decision: 'escalate',
      note: 'Accepted as recommendation; consequential steps require human approval.',
    };
  }
  return {
    decision: 'accept',
    note: 'Accepted for permitted low-risk / draft steps; financial steps still gated by tool policy.',
  };
}
