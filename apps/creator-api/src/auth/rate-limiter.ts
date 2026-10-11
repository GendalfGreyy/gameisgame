import { ApiError } from '@tg-creator/shared';

/**
 * Fixed-window in-memory limiter for auth endpoints. Per-instance only; a
 * shared Redis limiter is scheduled with production hardening (G11).
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now: number = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size > 10_000) {
        this.prune(now);
      }
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new ApiError({
        code: 'RATE_LIMITED',
        message: 'Слишком много попыток. Подождите минуту',
        details: { retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) },
      });
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) {
        this.hits.delete(key);
      }
    }
  }
}
