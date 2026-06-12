import type { Bot } from 'grammy';

import { botConfig } from '../config.js';
import { parseStartPayload } from '../deeplinks/parse.js';

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function registerStartCommand(bot: Bot) {
  bot.command('start', async (context) => {
    const payload = context.match?.trim();
    const intent = parseStartPayload(payload || undefined);
    const webappUrl = botConfig.webappUrl;

    const openAppText =
      intent.kind === 'event'
        ? 'Открываю событие в Mini App…'
        : intent.kind === 'referral'
          ? 'Тебя пригласили в Game is Game — заходи!'
          : 'Open Game is Game to find nearby events and earn points.';

    if (isHttpsUrl(webappUrl)) {
      const url =
        intent.kind === 'event'
          ? `${webappUrl}?tgWebAppStartParam=${encodeURIComponent(`evt_${intent.eventId}`)}`
          : webappUrl;

      await context.reply(openAppText, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Open Mini App', web_app: { url } }]],
        },
      });
      return;
    }

    await context.reply(
      `${openAppText}\n\n` +
        'Mini App locally: run an HTTPS tunnel (ngrok / cloudflared) to port 5173, ' +
        'set TELEGRAM_WEBAPP_URL in .env, then restart the bot.',
    );
  });
}
