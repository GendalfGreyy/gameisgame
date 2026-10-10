import { Bot, GrammyError } from 'grammy';

import { registerPaymentHandlers } from './commands/payments.js';
import { registerSquadCommand } from './commands/squad.js';
import { registerStartCommand } from './commands/start.js';
import { botConfig } from './config.js';
import { startNotificationWorker } from './notifications/worker.js';

const bot = new Bot(botConfig.token);

registerStartCommand(bot);
registerSquadCommand(bot);
registerPaymentHandlers(bot);
startNotificationWorker(bot, botConfig.redisUrl);

bot.catch((error) => {
  console.error('Bot error', error);
});

function isGetUpdatesConflict(error: unknown): boolean {
  return error instanceof GrammyError && error.error_code === 409 && error.method === 'getUpdates';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Long-polling conflicts (Telegram 409) happen when another instance still holds
 * getUpdates, or when a previous poll has not timed out yet after a restart.
 * Retry instead of crash-looping via Railway on_failure.
 */
async function startWithRetry(): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      console.log(`Starting Game is Game bot… (attempt ${String(attempt)})`);
      await bot.start({
        onStart: (info) => {
          console.log(`Bot @${info.username} polling`);
        },
      });
      return;
    } catch (error) {
      if (!isGetUpdatesConflict(error)) {
        throw error;
      }
      // Telegram long-poll timeout is typically 30s — wait it out (+jitter).
      const delayMs = Math.min(35_000, 5_000 + attempt * 2_000);
      console.warn(
        `getUpdates 409 conflict — another poller is active; retry in ${String(delayMs)}ms`,
      );
      await sleep(delayMs);
    }
  }
}

await startWithRetry();
