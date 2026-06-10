import { createHmac, timingSafeEqual } from 'node:crypto';

import { QR_TOKEN_LENGTH, QR_TOKEN_WINDOW_SECONDS } from '@game-is-game/shared';

/**
 * Rotating QR tokens (TOTP-style): HMAC-SHA256(secret, eventId|windowIndex)
 * truncated to QR_TOKEN_LENGTH hex chars. The host screen/stand re-renders the
 * token every QR_TOKEN_WINDOW_SECONDS; verification accepts the current and
 * the previous window to absorb clock skew and scan latency.
 *
 * Stateless by design — nothing to store or invalidate, and a screenshot of
 * the QR leaks at most ~60 seconds of validity.
 */

export function windowIndex(now: Date): number {
  return Math.floor(now.getTime() / 1000 / QR_TOKEN_WINDOW_SECONDS);
}

export function makeQrToken(secret: string, eventId: string, window: number): string {
  return createHmac('sha256', secret)
    .update(`${eventId}|${window}`)
    .digest('hex')
    .slice(0, QR_TOKEN_LENGTH);
}

export function verifyQrToken(
  secret: string,
  eventId: string,
  token: string,
  now = new Date(),
): boolean {
  const current = windowIndex(now);
  for (const window of [current, current - 1]) {
    const expected = makeQrToken(secret, eventId, window);
    if (
      token.length === expected.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

export function secondsUntilRotation(now = new Date()): number {
  const elapsed = Math.floor(now.getTime() / 1000) % QR_TOKEN_WINDOW_SECONDS;
  return QR_TOKEN_WINDOW_SECONDS - elapsed;
}
