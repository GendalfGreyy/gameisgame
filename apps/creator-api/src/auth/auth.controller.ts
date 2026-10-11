import { Body, Controller, HttpCode, Inject, Ip, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiError,
  devAuthRequestSchema,
  telegramAuthRequestSchema,
  type AuthResponse,
} from '@tg-creator/shared';

import { parseRequest } from '../common/validation.js';
import { isDevAuthAllowed, type Env } from '../config/env.schema.js';
import { UsersService, toProfile } from '../users/users.service.js';
import { Public } from './public.decorator.js';
import { FixedWindowLimiter } from './rate-limiter.js';
import { CurrentAuth } from './session.guard.js';
import { SessionService, type AuthContext } from './session.service.js';
import { verifyTelegramInitData } from './telegram-init-data.js';

@Controller('api/v1/auth')
export class AuthController {
  private readonly users: UsersService;
  private readonly sessions: SessionService;
  private readonly config: ConfigService<Env, true>;
  private readonly limiter = new FixedWindowLimiter(30, 60_000);

  constructor(
    @Inject(UsersService) users: UsersService,
    @Inject(SessionService) sessions: SessionService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.users = users;
    this.sessions = sessions;
    this.config = config;
  }

  @Public()
  @Post('telegram')
  @HttpCode(200)
  async telegram(@Body() body: unknown, @Ip() ip: string): Promise<AuthResponse> {
    this.limiter.consume(`tg:${ip}`);
    const { initData } = parseRequest(telegramAuthRequestSchema, body);
    const botToken = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    if (!botToken) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Вход через Telegram не настроен на сервере',
      });
    }
    const { user } = verifyTelegramInitData(initData, {
      botToken,
      maxAgeSeconds: this.config.get('CREATOR_AUTH_MAX_AGE_SECONDS', { infer: true }),
    });
    const record = await this.users.upsertFromTelegram({
      telegramId: BigInt(user.id),
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      username: user.username ?? null,
      photoUrl: user.photo_url ?? null,
      languageCode: user.language_code ?? null,
    });
    const session = await this.sessions.create(record.id);
    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: toProfile(record),
    };
  }

  /** Local testing outside Telegram. Hard-blocked unless NODE_ENV=development + CREATOR_DEV_AUTH. */
  @Public()
  @Post('dev')
  @HttpCode(200)
  async dev(@Body() body: unknown, @Ip() ip: string): Promise<AuthResponse> {
    const env = {
      NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
      CREATOR_DEV_AUTH: this.config.get('CREATOR_DEV_AUTH', { infer: true }),
    };
    if (!isDevAuthAllowed(env)) {
      throw new ApiError({
        code: 'AUTH_DEV_FORBIDDEN',
        message: 'Тестовый вход доступен только в режиме разработки',
      });
    }
    this.limiter.consume(`dev:${ip}`);
    const input = parseRequest(devAuthRequestSchema, body ?? {});
    const record = await this.users.upsertFromTelegram({
      telegramId: BigInt(input.telegramId),
      firstName: input.firstName,
      lastName: null,
      username: input.username,
      photoUrl: null,
      languageCode: 'ru',
    });
    const session = await this.sessions.create(record.id);
    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: toProfile(record),
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
  }
}
