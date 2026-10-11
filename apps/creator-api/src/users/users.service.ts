import { Inject, Injectable } from '@nestjs/common';
import {
  ApiError,
  DEFAULT_USER_PREFERENCES,
  userPreferencesSchema,
  type UpdatePreferencesRequest,
  type UserPreferences,
  type UserProfile,
} from '@tg-creator/shared';

import type { User } from '../../generated/client/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type TelegramIdentity = {
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
};

export function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
  };
}

/** Stored JSON is merged over defaults so new preference keys never break old rows. */
export function readPreferences(stored: unknown): UserPreferences {
  const merged = {
    ...DEFAULT_USER_PREFERENCES,
    ...(typeof stored === 'object' && stored !== null ? stored : {}),
  };
  const parsed = userPreferencesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_USER_PREFERENCES;
}

@Injectable()
export class UsersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /** Profile fields come from signed initData and are refreshed on every login. */
  async upsertFromTelegram(identity: TelegramIdentity): Promise<User> {
    const profile = {
      firstName: identity.firstName,
      lastName: identity.lastName,
      username: identity.username,
      photoUrl: identity.photoUrl,
      languageCode: identity.languageCode,
    };
    return this.prisma.user.upsert({
      where: { telegramId: identity.telegramId },
      create: { telegramId: identity.telegramId, ...profile },
      update: profile,
    });
  }

  async getById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError({ code: 'SESSION_EXPIRED', message: 'Сессия истекла. Войдите снова' });
    }
    return user;
  }

  async updatePreferences(
    userId: string,
    patch: UpdatePreferencesRequest,
  ): Promise<UserPreferences> {
    const user = await this.getById(userId);
    const current = readPreferences(user.preferences);
    const next: UserPreferences = {
      theme: patch.theme ?? current.theme,
      density: patch.density ?? current.density,
    };
    await this.prisma.user.update({ where: { id: userId }, data: { preferences: next } });
    return next;
  }
}
