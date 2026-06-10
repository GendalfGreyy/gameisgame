import type {
  FriendRequestsResponse,
  FriendsListResponse,
  SendFriendRequest,
} from '@game-is-game/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class FriendsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sendRequest(requesterId: string, input: SendFriendRequest) {
    if (requesterId === input.userId) {
      throw new BadRequestException('Cannot befriend yourself');
    }

    const addressee = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true },
    });
    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: input.userId },
          { requesterId: input.userId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'blocked') {
        // Do not leak the block: behave as if the request silently succeeded.
        return { id: existing.id, status: 'pending' as const };
      }
      if (existing.status === 'accepted') {
        throw new ConflictException('Already friends');
      }
      // Mutual pending: the reverse request exists — auto-accept it.
      if (existing.requesterId === input.userId && existing.status === 'pending') {
        const accepted = await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted' },
        });
        return { id: accepted.id, status: accepted.status };
      }
      return { id: existing.id, status: existing.status };
    }

    const friendship = await this.prisma.friendship.create({
      data: { requesterId, addresseeId: input.userId },
    });
    return { id: friendship.id, status: friendship.status };
  }

  async acceptRequest(friendshipId: string, actorId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (!friendship || friendship.addresseeId !== actorId) {
      throw new NotFoundException('Friend request not found');
    }
    if (friendship.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const accepted = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted' },
    });
    return { id: accepted.id, status: accepted.status };
  }

  async listFriends(userId: string): Promise<FriendsListResponse> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: { id: true, firstName: true, username: true, photoUrl: true, totalPoints: true, deletedAt: true },
        },
        addressee: {
          select: { id: true, firstName: true, username: true, photoUrl: true, totalPoints: true, deletedAt: true },
        },
      },
    });

    const items = friendships
      .map((f) => (f.requesterId === userId ? f.addressee : f.requester))
      .filter((u) => u.deletedAt === null)
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        username: u.username,
        photoUrl: u.photoUrl,
        totalPoints: u.totalPoints,
      }));

    return { items };
  }

  async listIncomingRequests(userId: string): Promise<FriendRequestsResponse> {
    const requests = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'pending' },
      include: {
        requester: {
          select: { id: true, firstName: true, username: true, photoUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: requests.map((r) => ({
        id: r.id,
        requester: {
          id: r.requester.id,
          firstName: r.requester.firstName,
          username: r.requester.username,
          photoUrl: r.requester.photoUrl,
        },
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
