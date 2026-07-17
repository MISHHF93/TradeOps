'use client';

import { useState, type ReactNode } from 'react';
import { AiContextPanel } from '../ai/ai-context-panel';
import { TerminalSidebar } from '../navigation/terminal-sidebar';
import { CommandBar } from './command-bar';
import type { ResolvedWorkspace } from '../../lib/workspace';

/**
 * Commerce OS shell: command bar · persona sidebar · workspace · AI panel
 */
export function TerminalShell({
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
}) {
  const [aiOpen, setAiOpen] = useState(true);

  return (
    <div className={`terminal-app ${aiOpen ? 'ai-open' : 'ai-closed'}`}>
      <CommandBar
        envLabel={process.env.NODE_ENV === 'production' ? 'prod' : 'local'}
        accessMode={accessMode}
        connectorSummary={connectorSummary}
        orgName={orgName}
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
        />
        <main className="terminal-main" id="main-workspace">
          {children}
        </main>
        <AiContextPanel
          open={aiOpen}
          onToggle={() => setAiOpen((v) => !v)}
          workspace={workspace}
        />
      </div>
    </div>
  );
}
