import pino, { type Logger, type LoggerOptions } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
  /** Extra base fields attached to every log line. */
  base?: Record<string, unknown>;
}

/**
 * Structured logger factory.
 * Never log secrets, tokens, or raw PII — redact at call sites.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const opts: LoggerOptions = {
    name: options.service,
    level: options.level ?? 'info',
    base: {
      service: options.service,
      ...options.base,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'authorization',
        'cookie',
        'secret',
        'credentials',
        'apiKey',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[Redacted]',
    },
  };

  return pino(opts);
}

export type { Logger };
