import { parse, validate } from '@telegram-apps/init-data-node';

const MAX_AUTH_AGE_SECONDS = 86_400;

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type ParsedInitData = {
  authDate: number;
  user: TelegramWebAppUser;
  startParam?: string;
};

export function validateTelegramInitData(initData: string, botToken: string): ParsedInitData {
  validate(initData, botToken, { expiresIn: MAX_AUTH_AGE_SECONDS });

  const parsed = parse(initData);
  const user = parsed.user;
  if (!user?.id || !user.first_name) {
    throw new Error('Invalid user payload');
  }

  return {
    authDate: Math.floor(new Date(parsed.auth_date).getTime() / 1000),
    ...(parsed.start_param !== undefined ? { startParam: parsed.start_param } : {}),
    user: {
      id: user.id,
      first_name: user.first_name,
      ...(user.last_name !== undefined ? { last_name: user.last_name } : {}),
      ...(user.username !== undefined ? { username: user.username } : {}),
      ...(user.photo_url !== undefined ? { photo_url: user.photo_url } : {}),
    },
  };
}
