import type { AuthResponse, HealthResponse, OrganizationDto } from '@tradeops/contracts';

/** Prefer 127.0.0.1 on the server to avoid Windows localhost/IPv6 hang issues. */
const DEFAULT_API_URL = 'http://127.0.0.1:4000';

/**
 * Default fetch timeout (ms). PGlite on Windows is slow; 4s was too low.
 * Override with API_TIMEOUT_MS or NEXT_PUBLIC_API_TIMEOUT_MS.
 */
export const DEFAULT_API_TIMEOUT_MS = (() => {
  const raw =
    process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? process.env.API_TIMEOUT_MS ?? '60000';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 60_000;
})();

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_PUBLIC_URL ?? DEFAULT_API_URL;
  }
  return process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? process.env.API_PUBLIC_URL ?? DEFAULT_API_URL;
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  cookieHeader?: string;
  cache?: RequestCache;
  /** Abort after this many ms (default DEFAULT_API_TIMEOUT_MS, typically 30s). */
  timeoutMs?: number;
};

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status: number }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.cookieHeader) {
      headers.Cookie = options.cookieHeader;
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      cache: options.cache ?? 'no-store',
      signal: controller.signal,
    });

    if (response.status === 204) {
      return { ok: true, data: undefined as T, status: 204 };
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = { message: text };
      }
    }

    if (!response.ok) {
      const message =
        typeof parsed === 'object' &&
        parsed !== null &&
        'message' in parsed &&
        (typeof (parsed as { message: unknown }).message === 'string' ||
          Array.isArray((parsed as { message: unknown }).message))
          ? Array.isArray((parsed as { message: unknown }).message)
            ? ((parsed as { message: string[] }).message).join('; ')
            : String((parsed as { message: string }).message)
          : `API returned HTTP ${response.status}`;
      return { ok: false, error: message, status: response.status };
    }

    return { ok: true, data: parsed as T, status: response.status };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const raw = error instanceof Error ? error.message : 'Failed to reach API';
    // Node often surfaces "fetch failed" when nothing listens on the API host.
    const friendlier =
      !aborted && /fetch failed|ECONNREFUSED|network/i.test(raw)
        ? `Cannot reach API at ${getApiBaseUrl()} (${raw})`
        : raw;
    return {
      ok: false,
      error: aborted ? `API timeout after ${timeoutMs}ms` : friendlier,
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchApiHealth(): Promise<
  { ok: true; data: HealthResponse } | { ok: false; error: string }
> {
  // Full readiness (postgres/redis). Slightly generous for PGlite health probes.
  const result = await apiFetch<HealthResponse>('/api/v1/health', {
    cache: 'no-store',
    timeoutMs: 15_000,
  });
  if (result.ok) {
    return { ok: true, data: result.data };
  }
  // Fall back to process liveness so the UI can distinguish "API down" vs "DB down".
  const live = await apiFetch<{ status: string; service: string }>('/api/v1/health/live', {
    cache: 'no-store',
    timeoutMs: 3_000,
  });
  if (live.ok) {
    return {
      ok: true,
      data: {
        status: 'degraded',
        service: live.data.service,
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 0,
        dependencies: [
          {
            name: 'postgres',
            status: 'down',
            message: result.error,
          },
        ],
      },
    };
  }
  return { ok: false, error: result.error };
}

export async function fetchSession(cookieHeader?: string) {
  return apiFetch<AuthResponse>('/api/v1/auth/me', {
    cookieHeader,
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
  });
}

export async function fetchOrganizations(cookieHeader?: string) {
  return apiFetch<OrganizationDto[]>('/api/v1/organizations', {
    cookieHeader,
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
  });
}
