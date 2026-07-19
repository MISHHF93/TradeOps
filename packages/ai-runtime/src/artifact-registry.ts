/**
 * AI artifact kinds produced by the operator / media engine.
 */

export type ArtifactKind =
  | 'execution_package'
  | 'recommendation_card'
  | 'listing_draft'
  | 'policy_assessment'
  | 'profit_calculation'
  | 'media_analysis'
  | 'search_evidence'
  | 'workflow_plan'
  | 'approval_request';

export type ArtifactKindDefinition = {
  kind: ArtifactKind;
  version: string;
  description: string;
  /** Whether human approval is required before acting on this artifact */
  approvalRequiredDefault: boolean;
  schemaId?: string;
};

const kinds = new Map<ArtifactKind, ArtifactKindDefinition>();

export function registerArtifactKind(def: ArtifactKindDefinition): void {
  kinds.set(def.kind, def);
}

export function getArtifactKind(kind: ArtifactKind): ArtifactKindDefinition | undefined {
  return kinds.get(kind);
}

export function listArtifactKinds(): ArtifactKindDefinition[] {
  return [...kinds.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

registerArtifactKind({
  kind: 'execution_package',
  version: '1.0.0',
  description: 'Full navigator package for an objective',
  approvalRequiredDefault: false,
  schemaId: 'execution_package',
});

registerArtifactKind({
  kind: 'recommendation_card',
  version: '1.0.0',
  description: 'Ranked product/case recommendation with evidence',
  approvalRequiredDefault: false,
});

registerArtifactKind({
  kind: 'listing_draft',
  version: '1.0.0',
  description: 'Local listing draft — not published',
  approvalRequiredDefault: false,
});

registerArtifactKind({
  kind: 'approval_request',
  version: '1.0.0',
  description: 'Consequential action awaiting human gate',
  approvalRequiredDefault: true,
});

registerArtifactKind({
  kind: 'search_evidence',
  version: '1.0.0',
  description: 'Search hit bundle with provenance',
  approvalRequiredDefault: false,
  schemaId: 'search_response',
});

registerArtifactKind({
  kind: 'workflow_plan',
  version: '1.0.0',
  description: 'Durable workflow plan steps',
  approvalRequiredDefault: true,
});

registerArtifactKind({
  kind: 'media_analysis',
  version: '1.0.0',
  description: 'Rule/multimodal media analysis proposal',
  approvalRequiredDefault: false,
});

registerArtifactKind({
  kind: 'policy_assessment',
  version: '1.0.0',
  description: 'Fail-closed policy outcome',
  approvalRequiredDefault: false,
});

registerArtifactKind({
  kind: 'profit_calculation',
  version: '1.0.0',
  description: 'Contribution profit calculation',
  approvalRequiredDefault: false,
});
