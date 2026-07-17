/**
 * Client types for Workspace Resolver (persona-driven Commerce OS).
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
    currentStage: string;
    stageStatus: string;
    nextActionLabel?: string | null;
  }>;
  aiContextPreamble: string;
  allPersonas: Array<{ id: OperatingPersona; label: string; homeHref: string }>;
};
