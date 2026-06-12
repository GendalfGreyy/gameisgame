import { Bot } from 'grammy';

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

console.log('Starting Game is Game bot…');
await bot.start();
