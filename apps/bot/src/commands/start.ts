import type { Bot } from 'grammy';

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function registerStartCommand(bot: Bot) {
  bot.command('start', async (context) => {
    const webappUrl = process.env.TELEGRAM_WEBAPP_URL ?? 'http://localhost:5173';

    if (isHttpsUrl(webappUrl)) {
      await context.reply('Open Game is Game to find nearby events and earn points.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open Mini App', web_app: { url: webappUrl } }]],
        },
      });
      return;
    }

    await context.reply(
      'Game is Game — nearby events, check-ins, points.\n\n' +
        'Mini App locally: run an HTTPS tunnel (ngrok / cloudflared) to port 5173, ' +
        'set TELEGRAM_WEBAPP_URL in .env, then restart the bot.',
    );
  });
}
