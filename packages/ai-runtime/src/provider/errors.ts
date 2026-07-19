/** Normalized AI provider errors — never leak raw SDK exceptions to clients. */

export type AiErrorCode =
  | 'AIProviderUnavailable'
  | 'AIRateLimited'
  | 'AIAuthenticationFailed'
  | 'AIRequestInvalid'
  | 'AISchemaRejected'
  | 'AIResponseEmpty'
  | 'AIResponseMalformed'
  | 'AITimeout'
  | 'AINotConfigured'
  | 'AIToolFailed'
  | 'AITenantRequired';

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  constructor(code: AiErrorCode, message: string, cause?: unknown, retryable = false) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'AiProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function mapHttpToAiError(status: number, message: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('AIAuthenticationFailed', message, undefined, false);
  }
  if (status === 429) {
    return new AiProviderError('AIRateLimited', message, undefined, true);
  }
  if (status === 400 || status === 422) {
    return new AiProviderError('AIRequestInvalid', message, undefined, false);
  }
  if (status >= 500) {
    return new AiProviderError('AIProviderUnavailable', message, undefined, true);
  }
  return new AiProviderError('AIProviderUnavailable', message, undefined, false);
}

export function mapUnknownToAiError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|abort/i.test(msg)) {
    return new AiProviderError('AITimeout', msg, err, true);
  }
  if (/401|403|unauthorized|invalid.*key/i.test(msg)) {
    return new AiProviderError('AIAuthenticationFailed', 'Provider authentication failed', err, false);
  }
  if (/429|rate.?limit/i.test(msg)) {
    return new AiProviderError('AIRateLimited', 'Provider rate limited', err, true);
  }
  return new AiProviderError('AIProviderUnavailable', msg, err, true);
}
