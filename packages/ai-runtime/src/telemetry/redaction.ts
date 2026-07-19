/**
 * Secret redaction for logs, diagnostics, and API payloads.
 */

const SECRET_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\b(sk-[A-Za-z0-9_\-]{10,})\b/g, replace: '[REDACTED_API_KEY]' },
  { re: /\b(xai-[A-Za-z0-9_\-]{10,})\b/g, replace: '[REDACTED_API_KEY]' },
  { re: /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, replace: '$1[REDACTED_TOKEN]' },
  { re: /(COHERE_API_KEY|OPENAI_API_KEY|XAI_API_KEY|TAVILY_API_KEY|APP_SECRET|CREDENTIALS_MASTER_KEY)\s*[=:]\s*\S+/gi, replace: '$1=[REDACTED]' },
  { re: /postgres(ql)?:\/\/[^:]+:[^@]+@/gi, replace: 'postgres://***:***@' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace: '[REDACTED_PRIVATE_KEY]' },
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, replace } of SECRET_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

export function redactDeep<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === 'string') return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/key|secret|token|password|authorization|credential/i.test(k) && typeof v === 'string') {
        out[k] = v ? '[REDACTED]' : v;
      } else {
        out[k] = redactDeep(v, depth + 1);
      }
    }
    return out as T;
  }
  return value;
}
