'use client';

import type { ReactNode } from 'react';
import { AiContextPanel } from '../ai/ai-context-panel';
import { TerminalSidebar } from '../navigation/terminal-sidebar';
import { CommandBar } from './command-bar';
import {
  AiOperatorProvider,
  useAiOperator,
} from '../../lib/ai-operator-context';
import type { ResolvedWorkspace } from '../../lib/workspace';

/**
 * Commerce OS shell:
 *   Command bar · Persona sidebar · Main workspace · AI Operator rail
 *
 * AI is a persistent contextual capability — not a competing center page.
 */
function TerminalShellInner({
  children,
  founderDirect,
  orgName,
  email,
  role,
  segment,
  planTier,
  accessMode,
  connectorSummary,
  founderSlot,
  logoutSlot,
  workspace,
  tenantLabel,
  workspaceLabel,
  commerceMode,
  navSource,
}: {
  children: ReactNode;
  founderDirect: boolean;
  orgName: string;
  email: string;
  role: string;
  segment?: string;
  planTier?: string;
  accessMode: string;
  connectorSummary?: string;
  founderSlot?: ReactNode;
  logoutSlot?: ReactNode;
  workspace?: ResolvedWorkspace | null;
  tenantLabel?: string | null;
  workspaceLabel?: string | null;
  commerceMode?: string | null;
  navSource?: 'workspace' | 'fallback';
}) {
  const { open, setOpen, railMode, setRailMode } = useAiOperator();

  return (
    <div
      className={`terminal-app ${open ? 'ai-open' : 'ai-closed'} ai-rail-${railMode}`}
      data-ai-rail={railMode}
    >
      <CommandBar
        envLabel={process.env.NODE_ENV === 'production' ? 'prod' : 'local'}
        accessMode={accessMode}
        connectorSummary={connectorSummary}
        founderSlot={founderSlot}
      />
      <div className="terminal-body">
        <TerminalSidebar
          founderDirect={founderDirect}
          orgName={orgName}
          email={email}
          role={role}
          segment={segment}
          planTier={planTier}
          showLogout={!founderDirect}
          logoutSlot={logoutSlot}
          workspace={workspace}
          tenantLabel={tenantLabel}
          workspaceLabel={workspaceLabel}
          commerceMode={commerceMode}
          navSource={navSource}
        />
        <main className="terminal-main" id="main-workspace">
          {children}
        </main>
        <AiContextPanel
          open={open}
          onToggle={() => setOpen(!open)}
          railMode={railMode}
          onRailModeChange={setRailMode}
          workspace={workspace}
        />
      </div>
    </div>
  );
}

export function TerminalShell(props: {
  children: ReactNode;
  founderDirect: boolean;
  orgName: string;
  email: string;
  role: string;
  segment?: string;
  planTier?: string;
  accessMode: string;
  connectorSummary?: string;
  founderSlot?: ReactNode;
  logoutSlot?: ReactNode;
  workspace?: ResolvedWorkspace | null;
  tenantLabel?: string | null;
  workspaceLabel?: string | null;
  commerceMode?: string | null;
  navSource?: 'workspace' | 'fallback';
}) {
  return (
    <AiOperatorProvider>
      <TerminalShellInner {...props} />
    </AiOperatorProvider>
  );
}
