import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Simple in-process rate limiter for auth endpoints (public launch hardener).
 * Replace with Redis-backed limiter for multi-instance production.
 */
@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  /**
   * @param key stable client key (ip + route)
   * @param limit max attempts per window
   * @param windowMs window length
   */
  assertWithinLimit(key: string, limit = 20, windowMs = 15 * 60 * 1000): void {
    const now = Date.now();
    const cur = this.buckets.get(key);
    if (!cur || cur.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    cur.count += 1;
    if (cur.count > limit) {
      const retrySec = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many attempts. Retry in ${retrySec}s.`,
          retryAfterSeconds: retrySec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
