import type { OperationLoopMode, ToolDefinition, ToolExecutionContext, ToolTraceEntry } from './types';

const tools = new Map<string, ToolDefinition>();

export function registerTool<TIn, TOut>(def: ToolDefinition<TIn, TOut>): void {
  if (tools.has(def.name)) {
    throw new Error(`Tool already registered: ${def.name}`);
  }
  tools.set(def.name, def as ToolDefinition);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function listTools(): ToolDefinition[] {
  return [...tools.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function listToolsPublic() {
  return listTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    requiredPermissions: t.requiredPermissions,
    requiredConnectorCapability: t.requiredConnectorCapability ?? null,
    actionClass: t.risk.actionClass,
    approvalRequired: t.risk.approvalRequired,
    allowedInLoopModes: t.risk.allowedInLoopModes,
    timeoutMs: t.timeoutMs,
    idempotent: t.idempotent,
  }));
}

export class ToolInvocationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unknown_tool'
      | 'permission_denied'
      | 'loop_mode_forbidden'
      | 'prohibited'
      | 'timeout'
      | 'execution_failed',
  ) {
    super(message);
    this.name = 'ToolInvocationError';
  }
}

export async function invokeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<{ result: unknown; trace: ToolTraceEntry }> {
  const tool = getTool(name);
  if (!tool) {
    throw new ToolInvocationError(`Unknown tool: ${name}`, 'unknown_tool');
  }
  if (tool.risk.actionClass === 'prohibited') {
    throw new ToolInvocationError(`Tool is prohibited: ${name}`, 'prohibited');
  }
  if (!tool.risk.allowedInLoopModes.includes(ctx.loopMode)) {
    throw new ToolInvocationError(
      `Tool ${name} not allowed in loop mode ${ctx.loopMode}`,
      'loop_mode_forbidden',
    );
  }
  for (const perm of tool.requiredPermissions) {
    if (!ctx.permissions.includes(perm) && !ctx.permissions.includes('*')) {
      throw new ToolInvocationError(`Missing permission ${perm} for ${name}`, 'permission_denied');
    }
  }

  const started = Date.now();
  try {
    const result = await withTimeout(tool.execute(input, ctx), tool.timeoutMs);
    return {
      result,
      trace: {
        tool: name,
        input,
        output: result,
        actionClass: tool.risk.actionClass,
        durationMs: Date.now() - started,
        at: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof ToolInvocationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('timeout')) {
      throw new ToolInvocationError(`Tool ${name} timed out after ${tool.timeoutMs}ms`, 'timeout');
    }
    return {
      result: null,
      trace: {
        tool: name,
        input,
        error: message,
        actionClass: tool.risk.actionClass,
        durationMs: Date.now() - started,
        at: new Date().toISOString(),
      },
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function resolveLoopMode(input?: {
  forceFixture?: boolean;
  forceShadow?: boolean;
  hasLiveCredentials?: boolean;
  controlledLiveEnabled?: boolean;
}): OperationLoopMode {
  if (input?.forceFixture) return 'fixture';
  if (input?.forceShadow) return 'shadow';
  if (input?.controlledLiveEnabled && input.hasLiveCredentials) return 'controlled_live';
  if (input?.hasLiveCredentials) return 'development';
  return 'development';
}

export function describeLoopModes(): Array<{ mode: OperationLoopMode; meaning: string }> {
  return [
    {
      mode: 'fixture',
      meaning: 'Deterministic fake products/events for automated tests only — never labeled live.',
    },
    {
      mode: 'development',
      meaning:
        'Real DB, real contracts, sandbox/dev credentials where offered — production-compatible paths.',
    },
    {
      mode: 'shadow',
      meaning:
        'Real data and real AI decisions; consequential execution disabled or approval-controlled for evaluation.',
    },
    {
      mode: 'controlled_live',
      meaning: 'Authorized production APIs with policy limits and human approval for risk.',
    },
    {
      mode: 'automated_live',
      meaning: 'Only proven low-risk workflows auto-execute within explicit limits.',
    },
  ];
}
