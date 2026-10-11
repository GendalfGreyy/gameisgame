import { ApiError } from '@tg-creator/shared';
import { describe, expect, it } from 'vitest';

import {
  buildDataCheckString,
  signDataCheckString,
  verifyTelegramInitData,
} from './telegram-init-data.js';

/**
 * Test vector computed independently with Python's hmac/hashlib using the
 * official algorithm. The token is a fake fixture, not a real bot token.
 */
const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_bot_token';
const AUTH_DATE = 1_760_000_000;
const VECTOR_HASH = 'f4dc4de7ad5501671ea827839212845da442624d9ca99f05199f975565b2fcf9';
const VECTOR =
  'query_id=AAHdF6IQAAAAAN0XohDhrOrc' +
  '&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22%D0%90%D0%B4%D0%B0%22%2C%22last_name%22%3A%22%D0%9B%D0%B0%D0%B2%D0%BB%D0%B5%D0%B9%D1%81%22%2C%22username%22%3A%22ada%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%7D' +
  `&auth_date=${AUTH_DATE}` +
  '&signature=c2lnbmF0dXJlLXBsYWNlaG9sZGVy' +
  `&hash=${VECTOR_HASH}`;

const options = { botToken: BOT_TOKEN, maxAgeSeconds: 86_400, nowSeconds: AUTH_DATE + 60 };

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.code : 'NOT_API_ERROR';
  }
}

describe('verifyTelegramInitData', () => {
  it('matches the independently computed signature', () => {
    const params = new URLSearchParams(VECTOR);
    expect(signDataCheckString(buildDataCheckString(params), BOT_TOKEN)).toBe(VECTOR_HASH);
  });

  it('accepts valid initData and returns the signed user', () => {
    const result = verifyTelegramInitData(VECTOR, options);
    expect(result.authDate).toBe(AUTH_DATE);
    expect(result.user).toMatchObject({ id: 279058397, first_name: 'Ада', username: 'ada' });
  });

  it('rejects a tampered field with AUTH_INVALID_SIGNATURE', () => {
    const tampered = VECTOR.replace('279058397', '279058398');
    expect(codeOf(() => verifyTelegramInitData(tampered, options))).toBe('AUTH_INVALID_SIGNATURE');
  });

  it('rejects a wrong hash, a missing hash and another bot token', () => {
    const wrongHash = VECTOR.replace(VECTOR_HASH, '0'.repeat(64));
    const noHash = VECTOR.replace(`&hash=${VECTOR_HASH}`, '');
    expect(codeOf(() => verifyTelegramInitData(wrongHash, options))).toBe('AUTH_INVALID_SIGNATURE');
    expect(codeOf(() => verifyTelegramInitData(noHash, options))).toBe('AUTH_INVALID_SIGNATURE');
    expect(codeOf(() => verifyTelegramInitData(VECTOR, { ...options, botToken: '1:other' }))).toBe(
      'AUTH_INVALID_SIGNATURE',
    );
  });

  it('rejects duplicated keys', () => {
    expect(codeOf(() => verifyTelegramInitData(`${VECTOR}&auth_date=1`, options))).toBe(
      'AUTH_INVALID_SIGNATURE',
    );
  });

  it('rejects stale and future auth_date with AUTH_EXPIRED', () => {
    expect(
      codeOf(() => verifyTelegramInitData(VECTOR, { ...options, nowSeconds: AUTH_DATE + 86_401 })),
    ).toBe('AUTH_EXPIRED');
    expect(
      codeOf(() => verifyTelegramInitData(VECTOR, { ...options, nowSeconds: AUTH_DATE - 3_600 })),
    ).toBe('AUTH_EXPIRED');
  });

  it('checks the signature before the timestamp', () => {
    const forged = VECTOR.replace(VECTOR_HASH, 'f'.repeat(64));
    expect(
      codeOf(() => verifyTelegramInitData(forged, { ...options, nowSeconds: AUTH_DATE + 10 ** 7 })),
    ).toBe('AUTH_INVALID_SIGNATURE');
  });
});
