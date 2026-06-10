import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

const DIGEST_QUEUE = 'digest';
const NOTIFICATION_QUEUE = 'notifications';

/** Tonight Digest goes out at 17:00 local server time. */
const TONIGHT_DIGEST_CRON = '0 17 * * *';
/** Win-back scan runs daily at noon. */
const WINBACK_CRON = '0 12 * * *';

/** Users active within this window receive the digest. */
const ACTIVE_WINDOW_DAYS = 30;
/** Win-back targets users silent between these bounds. */
const WINBACK_MIN_SILENT_DAYS = 7;
const WINBACK_MAX_SILENT_DAYS = 14;
/** Do not re-send win-back more often than this. */
const WINBACK_COOLDOWN_DAYS = 14;
const MAX_DIGEST_EVENTS = 3;

type DigestJob = { kind: 'tonight_digest' } | { kind: 'winback' };

type NotificationJob = {
  type: 'tonight_digest' | 'winback';
  telegramId: string;
  message: string;
};

@Injectable()
export class DigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private digestQueue!: Queue<DigestJob>;
  private notificationQueue!: Queue<NotificationJob>;
  private worker!: Worker<DigestJob>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    const connection = {
      url: this.configService.get('REDIS_URL', { infer: true }),
      maxRetriesPerRequest: null,
    };

    this.digestQueue = new Queue<DigestJob>(DIGEST_QUEUE, { connection });
    this.notificationQueue = new Queue<NotificationJob>(NOTIFICATION_QUEUE, { connection });

    await this.digestQueue.upsertJobScheduler('tonight-digest', { pattern: TONIGHT_DIGEST_CRON }, {
      name: 'tonight-digest',
      data: { kind: 'tonight_digest' },
    });
    await this.digestQueue.upsertJobScheduler('winback', { pattern: WINBACK_CRON }, {
      name: 'winback',
      data: { kind: 'winback' },
    });

    this.worker = new Worker<DigestJob>(
      DIGEST_QUEUE,
      async (job) => {
        if (job.data.kind === 'tonight_digest') {
          await this.runTonightDigest();
        } else {
          await this.runWinback();
        }
      },
      { connection },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Digest job failed: ${job?.name}`, error.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.digestQueue?.close();
    await this.notificationQueue?.close();
  }

  /**
   * Tonight Digest: top events starting before midnight, pushed to recently
   * active users. Hard rule: no supply → no push.
   */
  async runTonightDigest() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 59, 999);

    const events = await this.prisma.gameEvent.findMany({
      where: {
        status: 'published',
        startsAt: { gt: now, lte: midnight },
      },
      orderBy: [{ boostScore: 'desc' }, { hotScore: 'desc' }, { startsAt: 'asc' }],
      take: MAX_DIGEST_EVENTS,
      include: { _count: { select: { participants: true } } },
    });

    if (events.length === 0) {
      this.logger.log('Tonight digest skipped: no supply');
      return;
    }

    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recipients = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { checkIns: { some: { checkedInAt: { gte: activeSince } } } },
          { eventParticipants: { some: { joinedAt: { gte: activeSince } } } },
        ],
      },
      select: { telegramId: true },
    });

    const lines = events.map((event) => {
      const time = event.startsAt.toTimeString().slice(0, 5);
      return `• ${time} — ${event.title} (${event._count.participants} идут)`;
    });
    const message = `Сегодня рядом:\n${lines.join('\n')}\n\nОткрывай Game is Game и выбирай.`;

    for (const recipient of recipients) {
      await this.notificationQueue.add('tonight_digest', {
        type: 'tonight_digest',
        telegramId: recipient.telegramId.toString(),
        message,
      });
    }

    this.logger.log(`Tonight digest queued for ${recipients.length} users, ${events.length} events`);
  }

  /**
   * Win-back: users silent for 7-14 days get one resurrection nudge via the
   * bot DM (the channel survives even when the Mini App is forgotten).
   */
  async runWinback() {
    const now = new Date();
    const minSilent = new Date(now.getTime() - WINBACK_MIN_SILENT_DAYS * 24 * 60 * 60 * 1000);
    const maxSilent = new Date(now.getTime() - WINBACK_MAX_SILENT_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        // Active at least once in the lookback period overall…
        checkIns: { some: { checkedInAt: { gte: maxSilent } } },
        // …but nothing in the recent silent window.
        NOT: {
          OR: [
            { checkIns: { some: { checkedInAt: { gte: minSilent } } } },
            { eventParticipants: { some: { joinedAt: { gte: minSilent } } } },
          ],
        },
      },
      select: { id: true, telegramId: true, firstName: true },
    });

    let queued = 0;
    for (const user of candidates) {
      const cooldownKey = `winback:${user.id}`;
      const alreadySent = await this.redis.client.get(cooldownKey);
      if (alreadySent) {
        continue;
      }

      await this.notificationQueue.add('winback', {
        type: 'winback',
        telegramId: user.telegramId.toString(),
        message:
          `${user.firstName}, твоя неделя ждёт продолжения — ` +
          `один чек-ин на этой неделе вернёт стрик в игру. Посмотри, что рядом сегодня.`,
      });
      await this.redis.client.set(
        cooldownKey,
        now.toISOString(),
        'EX',
        WINBACK_COOLDOWN_DAYS * 24 * 60 * 60,
      );
      queued += 1;
    }

    this.logger.log(`Winback queued for ${queued} users`);
  }
}
