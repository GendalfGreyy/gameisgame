import type { UpdateUserSettings, UserLookup, UserProfile } from '@game-is-game/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async updateSettings(userId: string, input: UpdateUserSettings): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { privacyMode: input.privacyMode },
    });
    return this.authService.toUserProfile(user);
  }

  async lookupByUsername(username: string): Promise<UserLookup> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        username: { equals: username, mode: 'insensitive' },
      },
      select: { id: true, firstName: true, username: true, photoUrl: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
