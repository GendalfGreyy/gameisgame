import { Bot } from 'grammy';

import { registerStartCommand } from './commands/start.js';
import { botConfig } from './config.js';
import { startNotificationWorker } from './notifications/worker.js';

const bot = new Bot(botConfig.token);

registerStartCommand(bot);
startNotificationWorker(bot, botConfig.redisUrl);

bot.catch((error) => {
  console.error('Bot error', error);
});

console.log('Starting Game is Game bot…');
await bot.start();
