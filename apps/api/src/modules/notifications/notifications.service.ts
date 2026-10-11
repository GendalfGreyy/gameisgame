import { buildMiniAppDeepLink, encodeEventStartParam } from '@game-is-game/shared';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

export const NOTIFICATION_QUEUE = 'notifications';

export type NotificationJob = {
  type:
    | 'event_starting_soon'
    | 'friend_joined_event'
    | 'check_in_confirmed'
    | 'tonight_digest'
    | 'winback'
    | 'squad_recap';
  telegramId: string;
  message: string;
};

const EVENT_STARTING_CRON = '*/15 * * * *';
const STARTING_SOON_MINUTES = 45;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private queue!: Queue<NotificationJob>;
  private schedulerQueue!: Queue<{ kind: 'event_starting_soon' }>;
  private schedulerWorker!: Worker<{ kind: 'event_starting_soon' }>;

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    const connection = {
      url: this.configService.get('REDIS_URL', { infer: true }),
      maxRetriesPerRequest: null as null,
    };
    this.queue = new Queue<NotificationJob>(NOTIFICATION_QUEUE, { connection });

    this.schedulerQueue = new Queue<{ kind: 'event_starting_soon' }>('notification-schedulers', {
      connection,
    });
    void this.schedulerQueue.upsertJobScheduler(
      'event-starting-soon',
      { pattern: EVENT_STARTING_CRON },
      { name: 'event-starting-soon', data: { kind: 'event_starting_soon' } },
    );

    this.schedulerWorker = new Worker<{ kind: 'event_starting_soon' }>(
      'notification-schedulers',
      async () => {
        await this.runEventStartingSoon();
      },
      { connection },
    );

    this.schedulerWorker.on('failed', (job, error) => {
      this.logger.error(`Scheduler job ${job?.id} failed`, error);
    });
  }

  async onModuleDestroy() {
    await this.schedulerWorker?.close();
    await this.schedulerQueue?.close();
    await this.queue?.close();
  }

  getQueue(): Queue<NotificationJob> {
    return this.queue;
  }

  eventDeepLink(eventId: string): string {
    const botUsername = this.configService.get('TELEGRAM_BOT_USERNAME', { infer: true });
    return buildMiniAppDeepLink(botUsername, encodeEventStartParam(eventId));
  }

  async enqueue(job: NotificationJob): Promise<void> {
    await this.queue.add(job.type, job, { removeOnComplete: 1000, removeOnFail: 5000 });
  }

  async notifyFriendJoinedEvent(params: {
    friendTelegramId: string;
    joinerFirstName: string;
    eventTitle: string;
    eventId: string;
  }): Promise<void> {
    const link = this.eventDeepLink(params.eventId);
    await this.enqueue({
      type: 'friend_joined_event',
      telegramId: params.friendTelegramId,
      message: `${params.joinerFirstName} идёт на «${params.eventTitle}». ${link}`,
    });
  }

  async notifyCheckInConfirmed(params: {
    telegramId: string;
    eventTitle: string;
    points: number;
    eventId: string;
  }): Promise<void> {
    const link = this.eventDeepLink(params.eventId);
    await this.enqueue({
      type: 'check_in_confirmed',
      telegramId: params.telegramId,
      message: `Чек-ин на «${params.eventTitle}» подтверждён — +${params.points} очков. ${link}`,
    });
  }

  async notifyFriendsOfJoin(eventId: string, joinerId: string): Promise<void> {
    const [event, joiner, friendships] = await Promise.all([
      this.prisma.gameEvent.findUnique({
        where: { id: eventId },
        select: { title: true },
      }),
      this.prisma.user.findUnique({
        where: { id: joinerId },
        select: { firstName: true },
      }),
      this.prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: joinerId }, { addresseeId: joinerId }],
        },
        select: { requesterId: true, addresseeId: true },
      }),
    ]);

    if (!event || !joiner) {
      return;
    }

    const friendIds = friendships.map((f) =>
      f.requesterId === joinerId ? f.addresseeId : f.requesterId,
    );
    if (friendIds.length === 0) {
      return;
    }

    const friends = await this.prisma.user.findMany({
      where: { id: { in: friendIds }, deletedAt: null, privacyMode: { not: 'hidden' } },
      select: { telegramId: true },
    });

    await Promise.all(
      friends.map((friend) =>
        this.notifyFriendJoinedEvent({
          friendTelegramId: friend.telegramId.toString(),
          joinerFirstName: joiner.firstName,
          eventTitle: event.title,
          eventId,
        }),
      ),
    );
  }

  private async runEventStartingSoon(): Promise<void> {
    const windowStart = new Date(Date.now() + (STARTING_SOON_MINUTES - 15) * 60 * 1000);
    const windowEnd = new Date(Date.now() + STARTING_SOON_MINUTES * 60 * 1000);

    const events = await this.prisma.gameEvent.findMany({
      where: {
        status: 'published',
        startsAt: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        participants: {
          select: { user: { select: { id: true, telegramId: true } } },
        },
      },
    });

    for (const event of events) {
      const link = this.eventDeepLink(event.id);
      for (const participant of event.participants) {
        const dedupeKey = `notify-starting:${event.id}:${participant.user.id}`;
        const inserted = await this.redis.client.set(dedupeKey, '1', 'EX', 86_400, 'NX');
        if (inserted !== 'OK') {
          continue;
        }

        await this.enqueue({
          type: 'event_starting_soon',
          telegramId: participant.user.telegramId.toString(),
          message: `«${event.title}» скоро начнётся — успей добраться. ${link}`,
        });
      }
    }
  }
}
