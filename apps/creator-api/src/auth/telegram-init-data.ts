import { createHmac, timingSafeEqual } from 'node:crypto';

import { ApiError } from '@tg-creator/shared';
import { z } from 'zod';

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().default(''),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  language_code: z.string().optional(),
});

export type TelegramInitUser = z.infer<typeof telegramUserSchema>;

export type VerifiedInitData = {
  user: TelegramInitUser;
  authDate: number;
};

export type VerifyOptions = {
  botToken: string;
  maxAgeSeconds: number;
  /** Unix seconds; injectable for tests. */
  nowSeconds?: number;
};

/** Tolerated clock skew for an `auth_date` slightly in the future. */
const FUTURE_SKEW_SECONDS = 60;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function invalidSignature(): ApiError {
  return new ApiError({
    code: 'AUTH_INVALID_SIGNATURE',
    message: 'Не удалось подтвердить вход через Telegram',
  });
}

/** data-check-string: every field except `hash`, sorted by key, `key=value` joined by `\n`. */
export function buildDataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function signDataCheckString(dataCheckString: string, botToken: string): string {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

/**
 * Validates raw `Telegram.WebApp.initData` per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * The signature is checked before `auth_date`, so forged payloads never learn
 * whether their timestamp would have been accepted.
 */
export function verifyTelegramInitData(initData: string, options: VerifyOptions): VerifiedInitData {
  const params = new URLSearchParams(initData);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) {
    throw invalidSignature();
  }

  const hash = params.get('hash') ?? '';
  if (!HASH_PATTERN.test(hash)) {
    throw invalidSignature();
  }

  const expected = Buffer.from(
    signDataCheckString(buildDataCheckString(params), options.botToken),
    'hex',
  );
  const received = Buffer.from(hash, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw invalidSignature();
  }

  const authDate = Number(params.get('auth_date'));
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isInteger(authDate) ||
    authDate <= 0 ||
    now - authDate > options.maxAgeSeconds ||
    authDate - now > FUTURE_SKEW_SECONDS
  ) {
    throw new ApiError({
      code: 'AUTH_EXPIRED',
      message: 'Данные входа устарели. Перезапустите приложение в Telegram',
    });
  }

  let rawUser: unknown;
  try {
    rawUser = JSON.parse(params.get('user') ?? 'null');
  } catch {
    throw invalidSignature();
  }
  const user = telegramUserSchema.safeParse(rawUser);
  if (!user.success) {
    throw invalidSignature();
  }

  return { user: user.data, authDate };
}
