import { describe, expect, it } from 'vitest';

import { makeQrToken, secondsUntilRotation, verifyQrToken, windowIndex } from './qr-token.js';

const SECRET = 'test-secret-test-secret-test-secret!';
const EVENT = 'evt_123';

describe('qr-token', () => {
  it('accepts a token from the current window', () => {
    const now = new Date('2026-06-10T18:00:10Z');
    const token = makeQrToken(SECRET, EVENT, windowIndex(now));
    expect(verifyQrToken(SECRET, EVENT, token, now)).toBe(true);
  });

  it('accepts a token from the previous window (clock skew)', () => {
    const now = new Date('2026-06-10T18:00:35Z');
    const previous = makeQrToken(SECRET, EVENT, windowIndex(now) - 1);
    expect(verifyQrToken(SECRET, EVENT, previous, now)).toBe(true);
  });

  it('rejects a token older than one window', () => {
    const now = new Date('2026-06-10T18:02:00Z');
    const stale = makeQrToken(SECRET, EVENT, windowIndex(now) - 2);
    expect(verifyQrToken(SECRET, EVENT, stale, now)).toBe(false);
  });

  it('rejects a token for a different event', () => {
    const now = new Date('2026-06-10T18:00:10Z');
    const token = makeQrToken(SECRET, 'evt_other', windowIndex(now));
    expect(verifyQrToken(SECRET, EVENT, token, now)).toBe(false);
  });

  it('rejects garbage tokens', () => {
    const now = new Date('2026-06-10T18:00:10Z');
    expect(verifyQrToken(SECRET, EVENT, 'deadbeef', now)).toBe(false);
    expect(verifyQrToken(SECRET, EVENT, '', now)).toBe(false);
  });

  it('reports time until rotation within (0, window]', () => {
    const seconds = secondsUntilRotation(new Date('2026-06-10T18:00:10Z'));
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(30);
  });
});
