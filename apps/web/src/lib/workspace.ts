/**
 * Client types for Workspace Resolver (persona-driven Commerce OS).
 * Principle: One User · One Workspace · One Objective · One AI
 */

export type OperatingPersona =
  | 'executive'
  | 'operator'
  | 'researcher'
  | 'analyst'
  | 'developer'
  | 'administrator';

export type WorkspaceNavItem = {
  id: string;
  href: string;
  label: string;
  kind: string;
  procedureId?: string;
  stepId?: string;
  status?: string;
  badge?: string;
};

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
};

export type WorkspaceProcedure = {
  id: string;
  persona: OperatingPersona;
  label: string;
  summary: string;
  completionCriteria: string;
  steps: Array<{
    id: string;
    label: string;
    description: string;
    href: string;
    commerceStage?: string;
  }>;
  progress: { total: number; completedHint: number };
  activeStepId: string | null;
};

export type WorkspaceSurface = {
  principles: string[];
  todaysPriorities: Array<{
    id: string;
    label: string;
    href: string;
    urgency: string;
    reason: string;
  }>;
  aiBriefing: string;
  activeObjectives: Array<{
    id: string;
    title: string;
    href: string;
    status: string;
    kind: string;
  }>;
  recommendedActions: Array<{ label: string; href: string; reason: string }>;
  keyKpis: Array<{
    id: string;
    label: string;
    value: string | number;
    href?: string;
    tone?: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    message: string;
    href?: string;
  }>;
  everythingElseHint: string;
  attentionScore?: number;
  healthLabel?: string;
  focusObjective?: string;
  insights?: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string;
    urgencyScore: number;
    confidence: number;
    href: string;
    suggestedObjective: string;
    suggestedAiQuery?: string;
  }>;
};

export type ResolvedWorkspace = {
  persona: OperatingPersona;
  personaLabel: string;
  mission: string;
  homeHref: string;
  defaultObjective: string;
  currentObjective: string;
  nav: WorkspaceNavGroup[];
  procedures: WorkspaceProcedure[];
  allowedAiTools: string[];
  organizationId: string;
  organizationName?: string;
  userId?: string | null;
  userEmail?: string | null;
  pendingApprovals: number;
  openTasks: number;
  openBlockers: number;
  activeCaseCount: number;
  recommendedNextAction: {
    label: string;
    href: string;
    procedureId?: string;
    reason: string;
  } | null;
  availableConnectors: Array<{ providerKey: string; status: string; isFixture?: boolean }>;
  activeCases?: Array<{
    caseId: string;
    productId: string;
    productTitle?: string;
    primaryImageUrl?: string | null;
    currentStage: string;
    stageStatus: string;
    nextActionLabel?: string | null;
    nextHref?: string | null;
    opportunityScore?: number | null;
    expectedProfitMinor?: number | null;
    currency?: string;
    blockerMessage?: string | null;
  }>;
  aiContextPreamble: string;
  allPersonas: Array<{ id: OperatingPersona; label: string; homeHref: string }>;
  surface?: WorkspaceSurface;
  operatingPrinciple?: string;
  intelligence?: {
    generatedAt: string;
    attentionScore: number;
    healthLabel: string;
    narrative: string;
    focusObjective: string;
    honesty?: { note?: string };
  };
};
