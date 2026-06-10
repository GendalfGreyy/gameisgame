import { Worker } from 'bullmq';
import type { Bot } from 'grammy';
import { Redis as RedisClient } from 'ioredis';

const NOTIFICATION_QUEUE = 'notifications';
const DAILY_CAP = 5;

type NotificationJob = {
  type:
    | 'event_starting_soon'
    | 'friend_joined_event'
    | 'check_in_confirmed'
    | 'tonight_digest'
    | 'winback';
  telegramId: string;
  message: string;
};

export function startNotificationWorker(bot: Bot, redisUrl: string) {
  const rateLimitRedis = new RedisClient(redisUrl);

  const worker = new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    async (job) => {
      const counterKey = `notify:${job.data.telegramId}:${new Date().toISOString().slice(0, 10)}`;
      const count = await rateLimitRedis.incr(counterKey);
      if (count === 1) {
        await rateLimitRedis.expire(counterKey, 86_400);
      }
      if (count > DAILY_CAP) {
        return;
      }

      await bot.api.sendMessage(Number(job.data.telegramId), job.data.message);
    },
    {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
    },
  );

  worker.on('failed', (job, error) => {
    console.error('Notification job failed', job?.id, error);
  });

  return worker;
}
