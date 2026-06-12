import { Inject, Injectable } from '@nestjs/common';
import type { PointsReason, Prisma } from '@game-is-game/db';
import { POINTS_INVITE_FRIEND } from '@game-is-game/shared';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PointsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async award(params: {
    userId: string;
    amount: number;
    reason: PointsReason;
    referenceType?: string;
    referenceId?: string;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;

    const entry = await client.pointsLedger.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        reason: params.reason,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
      },
    });

    await client.user.update({
      where: { id: params.userId },
      data: { totalPoints: { increment: params.amount } },
    });

    return entry;
  }

  /** Idempotent invite reward — one grant per invitee. */
  async awardInviteFriend(
    inviterId: string,
    inviteeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const existing = await client.pointsLedger.findFirst({
      where: {
        userId: inviterId,
        reason: 'invite_friend',
        referenceId: inviteeId,
      },
    });
    if (existing) {
      return;
    }

    await this.award({
      userId: inviterId,
      amount: POINTS_INVITE_FRIEND,
      reason: 'invite_friend',
      referenceType: 'user',
      referenceId: inviteeId,
      ...(tx !== undefined ? { tx } : {}),
    });
  }

  async getLeaderboard(userId: string, limit = 20) {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { totalPoints: 'desc' },
      take: limit,
      select: {
        id: true,
        firstName: true,
        username: true,
        photoUrl: true,
        totalPoints: true,
      },
    });

    const items = users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      firstName: user.firstName,
      username: user.username,
      photoUrl: user.photoUrl,
      totalPoints: user.totalPoints,
    }));

    const myRankIndex = items.findIndex((item) => item.userId === userId);
    let myRank: number | null = myRankIndex >= 0 ? myRankIndex + 1 : null;

    if (myRank === null) {
      const me = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { totalPoints: true },
      });
      if (me) {
        const ahead = await this.prisma.user.count({
          where: { deletedAt: null, totalPoints: { gt: me.totalPoints } },
        });
        myRank = ahead + 1;
      }
    }

    return { items, myRank };
  }
}
