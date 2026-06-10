import { randomBytes } from 'node:crypto';

import type {
  CreateSquadRequest,
  JoinSquadRequest,
  SquadDetail,
  SquadLeaderboardResponse,
} from '@game-is-game/shared';
import { SQUAD_MAX_MEMBERS } from '@game-is-game/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { weekStartUtc } from '../streaks/streak.util.js';

/** Unambiguous alphabet (no 0/O, 1/I/L). */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

@Injectable()
export class SquadsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(ownerId: string, input: CreateSquadRequest): Promise<SquadDetail> {
    const existingMembership = await this.prisma.squadMember.findUnique({
      where: { userId: ownerId },
    });
    if (existingMembership) {
      throw new ConflictException('Already in a squad — leave it first');
    }

    const squad = await this.prisma.$transaction(async (tx) => {
      const created = await tx.squad.create({
        data: {
          name: input.name,
          ownerId,
          inviteCode: this.generateInviteCode(),
        },
      });
      await tx.squadMember.create({
        data: { squadId: created.id, userId: ownerId },
      });
      return created;
    });

    return this.getDetail(squad.id);
  }

  async join(userId: string, input: JoinSquadRequest): Promise<SquadDetail> {
    const squad = await this.prisma.squad.findUnique({
      where: { inviteCode: input.inviteCode.toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!squad) {
      throw new NotFoundException('Invalid invite code');
    }
    if (squad._count.members >= SQUAD_MAX_MEMBERS) {
      throw new BadRequestException('Squad is full');
    }

    const existingMembership = await this.prisma.squadMember.findUnique({
      where: { userId },
    });
    if (existingMembership) {
      throw new ConflictException('Already in a squad — leave it first');
    }

    await this.prisma.squadMember.create({
      data: { squadId: squad.id, userId },
    });

    return this.getDetail(squad.id);
  }

  async leave(userId: string) {
    const membership = await this.prisma.squadMember.findUnique({
      where: { userId },
      include: { squad: { include: { _count: { select: { members: true } } } } },
    });
    if (!membership) {
      throw new NotFoundException('Not in a squad');
    }

    if (membership.squad.ownerId === userId && membership.squad._count.members > 1) {
      throw new ForbiddenException('Transfer ownership or disband: other members remain');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.squadMember.delete({ where: { userId } });
      // Last member out closes the squad.
      if (membership.squad._count.members === 1) {
        await tx.squad.delete({ where: { id: membership.squadId } });
      }
    });

    return { left: true };
  }

  async getMine(userId: string): Promise<SquadDetail> {
    const membership = await this.prisma.squadMember.findUnique({
      where: { userId },
      select: { squadId: true },
    });
    if (!membership) {
      throw new NotFoundException('Not in a squad');
    }
    return this.getDetail(membership.squadId);
  }

  async getLeaderboard(userId: string, limit = 20): Promise<SquadLeaderboardResponse> {
    const weekStart = weekStartUtc(new Date());

    const rows = await this.prisma.$queryRaw<
      { squad_id: string; name: string; member_count: bigint; weekly_points: bigint }[]
    >`
      SELECT
        s.id AS squad_id,
        s.name,
        COUNT(DISTINCT sm.id) AS member_count,
        COALESCE(SUM(pl.amount), 0)::bigint AS weekly_points
      FROM squads s
      INNER JOIN squad_members sm ON sm.squad_id = s.id
      LEFT JOIN points_ledger pl
        ON pl.user_id = sm.user_id
        AND pl.created_at >= ${weekStart}
        AND pl.amount > 0
      GROUP BY s.id
      ORDER BY weekly_points DESC, member_count DESC
      LIMIT ${limit}
    `;

    const items = rows.map((row, index) => ({
      rank: index + 1,
      squadId: row.squad_id,
      name: row.name,
      memberCount: Number(row.member_count),
      weeklyPoints: Number(row.weekly_points),
    }));

    const membership = await this.prisma.squadMember.findUnique({
      where: { userId },
      select: { squadId: true },
    });
    const mySquadRank = membership
      ? (items.find((item) => item.squadId === membership.squadId)?.rank ?? null)
      : null;

    return { items, mySquadRank };
  }

  private async getDetail(squadId: string): Promise<SquadDetail> {
    const squad = await this.prisma.squad.findUniqueOrThrow({
      where: { id: squadId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                username: true,
                photoUrl: true,
                totalPoints: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    const weekStart = weekStartUtc(new Date());
    const weekly = await this.prisma.pointsLedger.aggregate({
      where: {
        userId: { in: squad.members.map((m) => m.userId) },
        createdAt: { gte: weekStart },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });

    return {
      id: squad.id,
      name: squad.name,
      inviteCode: squad.inviteCode,
      ownerId: squad.ownerId,
      memberCount: squad.members.length,
      totalPoints: squad.members.reduce((sum, m) => sum + m.user.totalPoints, 0),
      weeklyPoints: weekly._sum.amount ?? 0,
      members: squad.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        username: m.user.username,
        photoUrl: m.user.photoUrl,
        totalPoints: m.user.totalPoints,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  private generateInviteCode(): string {
    const bytes = randomBytes(INVITE_LENGTH);
    let code = '';
    for (let i = 0; i < INVITE_LENGTH; i += 1) {
      code += INVITE_ALPHABET[(bytes[i] as number) % INVITE_ALPHABET.length];
    }
    return code;
  }
}
