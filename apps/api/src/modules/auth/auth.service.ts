import { randomBytes } from 'node:crypto';

import type { InviteLinkResponse, TelegramAuthResponse, UserProfile } from '@game-is-game/shared';
import {
  buildBotReferralLink,
  buildMiniAppDeepLink,
  encodeReferralStartParam,
  parseReferralStartParam,
} from '@game-is-game/shared';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@game-is-game/db';
import {
  isAuthDateInvalidError,
  isExpiredError,
  isSignatureInvalidError,
  isSignatureMissingError,
} from '@telegram-apps/init-data-node';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { PointsService } from '../points/points.service.js';
import { validateTelegramInitData } from './telegram-init-data.js';

function describeInitDataError(error: unknown): string {
  if (isSignatureInvalidError(error)) return 'signature_invalid (bot token mismatch?)';
  if (isSignatureMissingError(error)) return 'signature_missing';
  if (isAuthDateInvalidError(error)) return 'auth_date_invalid';
  if (isExpiredError(error)) return 'expired';
  if (error instanceof Error && error.message.length > 0) return error.message;
  if (error instanceof Error) return error.constructor.name;
  return 'unknown';
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
    @Inject(PointsService) private readonly pointsService: PointsService,
  ) {}

  async authenticateWithTelegram(initData: string): Promise<TelegramAuthResponse> {
    const botToken = this.configService.get('TELEGRAM_BOT_TOKEN', { infer: true });

    let parsed;
    try {
      parsed = validateTelegramInitData(initData, botToken);
    } catch (error: unknown) {
      const reason = describeInitDataError(error);
      if (process.env.NODE_ENV === 'development') {
        const tokenPrefix = botToken.split(':')[0] ?? '?';
        console.error(`initData validation failed: ${reason} (API bot id prefix: ${tokenPrefix})`);
      }
      throw new UnauthorizedException(
        process.env.NODE_ENV === 'development'
          ? `Invalid Telegram initData (${reason})`
          : 'Invalid Telegram initData',
      );
    }

    const bootstrapIds = this.configService
      .get('ADMIN_BOOTSTRAP_TELEGRAM_IDS', { infer: true })
      .split(',')
      .map((value: string) => value.trim())
      .filter((value: string) => value.length > 0);

    const isBootstrapAdmin = bootstrapIds.includes(String(parsed.user.id));
    const telegramId = BigInt(parsed.user.id);

    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    const referrerId =
      existing === null ? await this.resolveReferrerId(parsed.startParam) : null;

    const user = existing
      ? await this.prisma.user.update({
          where: { telegramId },
          data: {
            username: parsed.user.username ?? null,
            firstName: parsed.user.first_name,
            lastName: parsed.user.last_name ?? null,
            photoUrl: parsed.user.photo_url ?? null,
            deletedAt: null,
            ...(isBootstrapAdmin ? { role: 'admin' as const } : {}),
          },
        })
      : await this.prisma.user.create({
          data: {
            telegramId,
            username: parsed.user.username ?? null,
            firstName: parsed.user.first_name,
            lastName: parsed.user.last_name ?? null,
            photoUrl: parsed.user.photo_url ?? null,
            role: isBootstrapAdmin ? 'admin' : 'user',
            referredById: referrerId,
          },
        });

    if (user.deletedAt) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (existing === null && referrerId) {
      await this.pointsService.awardInviteFriend(referrerId, user.id);
    }

    return this.issueTokens(user);
  }

  getInviteLink(userId: string): InviteLinkResponse {
    const botUsername = this.configService.get('TELEGRAM_BOT_USERNAME', { infer: true });
    const startParam = encodeReferralStartParam(userId);
    return {
      startParam,
      miniAppUrl: buildMiniAppDeepLink(botUsername, startParam),
      botUrl: buildBotReferralLink(botUsername, userId),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET', { infer: true });
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedUserId = await this.redis.client.get(`refresh:${payload.jti}`);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.createAccessToken(user);
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  private async resolveReferrerId(startParam: string | undefined): Promise<string | null> {
    const referrerId = parseReferralStartParam(startParam);
    if (!referrerId) {
      return null;
    }

    const referrer = await this.prisma.user.findFirst({
      where: { id: referrerId, deletedAt: null },
      select: { id: true },
    });
    return referrer?.id ?? null;
  }

  private async issueTokens(user: User): Promise<TelegramAuthResponse> {
    const accessToken = this.createAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toUserProfile(user),
    };
  }

  private createAccessToken(user: User): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        telegramId: user.telegramId.toString(),
        role: user.role,
      },
      {
        secret: this.configService.get('JWT_SECRET', { infer: true }),
        expiresIn: this.configService.get('JWT_ACCESS_TTL', { infer: true }),
        issuer: this.configService.get('JWT_ISSUER', { infer: true }),
        audience: this.configService.get('JWT_AUDIENCE', { infer: true }),
      },
    );
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const jti = randomBytes(24).toString('hex');
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET', { infer: true });
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti },
      {
        secret: refreshSecret,
        expiresIn: this.configService.get('JWT_REFRESH_TTL', { infer: true }),
        issuer: this.configService.get('JWT_ISSUER', { infer: true }),
        audience: this.configService.get('JWT_AUDIENCE', { infer: true }),
      },
    );

    await this.redis.client.set(`refresh:${jti}`, userId, 'EX', REFRESH_TOKEN_TTL_SECONDS);
    return refreshToken;
  }

  toUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      role: user.role,
      privacyMode: user.privacyMode,
      totalPoints: user.totalPoints,
      streakDays: user.streakDays,
    };
  }
}
