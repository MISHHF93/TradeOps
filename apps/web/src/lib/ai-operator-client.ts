/**
 * Single browser client for the AI Operator path.
 * All UI entry points (right panel, /terminal/objectives console, side panel) must use this
 * so forceShadow / navigate / SSE behavior cannot drift.
 */
import { getApiBaseUrl } from './api';

export type OperatorProgressEvent = {
  state?: string;
  step?: string;
  detail?: string;
  at?: string;
  message?: string;
  code?: string;
};

export type OperatorRunResult = {
  runId?: string;
  status?: string;
  loopMode?: string;
  decision?: string;
  decisionNote?: string;
  responseSummary?: string;
  briefingSource?: string;
  objectiveType?: string;
  riskClass?: string;
  approvalRequired?: boolean;
  timeline?: Array<{ at: string; step: string; status: string; detail?: string }>;
  liveProgress?: OperatorProgressEvent[];
  recommendations?: unknown[];
  resultsPath?: string;
  objectivePath?: string;
  processPath?: string;
  requestId?: string;
  correlationId?: string;
  casesSynced?: number;
  dataSourcePlan?: unknown;
  learning?: unknown;
  harmonization?: unknown;
  honesty?: { note?: string; dataMode?: string; forceShadow?: boolean };
  envelope?: {
    meta?: { dataMode?: string; requestId?: string; state?: string };
    text?: string;
  };
  message?: string;
  code?: string;
  candidateStats?: { retrieved?: number; ranked?: number };
  toolTrace?: unknown[];
};

export type RunOperatorOptions = {
  objective: string;
  commerceCaseId?: string;
  /**
   * Opt-in only. Omit for normal sidebar/console runs (server resolves development).
   * Live examples may set true deliberately.
   */
  forceShadow?: boolean;
  /** Prefer SSE stream (default true). Falls back to JSON automatically. */
  preferStream?: boolean;
  onProgress?: (ev: OperatorProgressEvent) => void;
};

function operatorBody(opts: RunOperatorOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    objective: opts.objective,
    // Sidebar / console fast path — never force navigate navigator package.
    navigate: false,
  };
  if (opts.commerceCaseId) body.commerceCaseId = opts.commerceCaseId;
  // Only send forceShadow when explicitly true (opt-in). Never default-true.
  if (opts.forceShadow === true) body.forceShadow = true;
  return body;
}

function networkOperatorError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const offline =
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Load failed') ||
    msg.includes('Network request failed');
  if (offline) {
    return Object.assign(
      new Error(
        'API unreachable (connection refused). Start the stack: pnpm stack:up — then hard-refresh the browser.',
      ),
      { status: 0, body: { code: 'api_unreachable', message: msg } satisfies OperatorRunResult },
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

export async function runOperatorJson(
  opts: RunOperatorOptions,
): Promise<OperatorRunResult> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(operatorBody(opts)),
    });
  } catch (e) {
    throw networkOperatorError(e);
  }
  const body = (await res.json().catch(() => ({}))) as OperatorRunResult;
  if (!res.ok) {
    throw Object.assign(
      new Error(humanOperatorError(res.status, body)),
      { status: res.status, body },
    );
  }
  return body;
}

export async function runOperatorStream(
  opts: RunOperatorOptions,
): Promise<OperatorRunResult> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operatorBody(opts)),
    });
  } catch (e) {
    throw networkOperatorError(e);
  }

  if (!res.ok || !res.body) {
    // Fall through to JSON path caller
    const body = (await res.json().catch(() => ({}))) as OperatorRunResult;
    throw Object.assign(
      new Error(humanOperatorError(res.status, body)),
      { status: res.status, body },
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: OperatorRunResult | null = null;
  let eventName = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const chunk of parts) {
      let dataLine = '';
      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine) as OperatorProgressEvent & OperatorRunResult;
        if (eventName === 'state') {
          opts.onProgress?.(data);
        } else if (eventName === 'result') {
          finalResult = data as OperatorRunResult;
        } else if (eventName === 'error') {
          throw Object.assign(new Error(data.message || data.step || 'Stream error'), {
            status: 503,
            body: data,
          });
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  if (!finalResult) {
    throw new Error('Operator stream ended without a result event');
  }
  return finalResult;
}

/**
 * Canonical entry: SSE first, JSON fallback. No forceShadow unless opts.forceShadow === true.
 */
export async function runOperator(
  opts: RunOperatorOptions,
): Promise<{ result: OperatorRunResult; transport: 'sse' | 'json' }> {
  const preferStream = opts.preferStream !== false;
  if (preferStream) {
    try {
      const result = await runOperatorStream(opts);
      return { result, transport: 'sse' };
    } catch (e) {
      // Connection refused / api_unreachable: do not mask with a second failure
      const status = (e as { status?: number })?.status;
      if (status === 0) throw e;
      /* fall back to JSON */
    }
  }
  const result = await runOperatorJson(opts);
  return { result, transport: 'json' };
}

export function humanOperatorError(status: number, body: OperatorRunResult): string {
  if (status === 0 || body.code === 'api_unreachable') {
    return (
      body.message ??
      'API unreachable (connection refused). Start the stack: pnpm stack:up — then hard-refresh.'
    );
  }
  if (status === 503 || body.code === 'database_unavailable') {
    return (
      body.message ??
      'Database unavailable. Run `pnpm stack:up` (PGlite + API), then retry.'
    );
  }
  if (status === 500) {
    return (
      body.message ??
      'Operator server error (HTTP 500). Often means the database dropped mid-request — run `pnpm stack:up` and retry.'
    );
  }
  if (status === 401 || status === 403) {
    return body.message ?? 'Not authorized for AI operator.';
  }
  return body.message ?? `Operator failed (HTTP ${status})`;
}
