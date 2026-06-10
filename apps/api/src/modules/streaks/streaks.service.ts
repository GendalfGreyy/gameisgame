import { POINTS_STREAK_BONUS } from '@game-is-game/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@game-is-game/db';

import { PrismaService } from '../../prisma/prisma.service.js';
import { PointsService } from '../points/points.service.js';
import { applyWeeklyActivity } from './streak.util.js';

@Injectable()
export class StreaksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PointsService) private readonly pointsService: PointsService,
  ) {}

  /**
   * Marks the current week active for the user. Call inside the same
   * transaction that confirms the check-in. Awards the streak bonus when the
   * streak is extended (continuation or freeze bridge).
   */
  async recordWeeklyActivity(userId: string, tx: Prisma.TransactionClient, now = new Date()) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { streakWeeks: true, freezeTokens: true, lastActiveWeek: true },
    });

    const transition = applyWeeklyActivity(user, now);
    if (!transition.changed) {
      return transition;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        streakWeeks: transition.streakWeeks,
        freezeTokens: transition.freezeTokens,
        lastActiveWeek: transition.lastActiveWeek,
      },
    });

    if (transition.extended) {
      await this.pointsService.award({
        userId,
        amount: POINTS_STREAK_BONUS,
        reason: 'streak_bonus',
        referenceType: 'streak_week',
        referenceId: transition.lastActiveWeek.toISOString().slice(0, 10),
        tx,
      });
    }

    return transition;
  }

  async getMyStreak(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { streakWeeks: true, freezeTokens: true, lastActiveWeek: true },
    });
    return {
      streakWeeks: user.streakWeeks,
      freezeTokens: user.freezeTokens,
      lastActiveWeek: user.lastActiveWeek?.toISOString().slice(0, 10) ?? null,
    };
  }
}
