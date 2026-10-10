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
    const studioOnly = botConfig.studioMiniApp;

    const openAppText =
      intent.kind === 'studio-game'
        ? 'Открываю игру в Creator Studio…'
        : intent.kind === 'event'
          ? 'Открываю событие в Mini App…'
          : intent.kind === 'referral'
            ? studioOnly
              ? 'Тебя пригласили в Creator Studio — заходи собирать игру!'
              : 'Тебя пригласили в Game is Game — заходи!'
            : studioOnly
              ? 'Creator Studio — собери игру в Telegram и поделись с друзьями.'
              : 'Open Game is Game to find nearby events and earn points.';

    if (isHttpsUrl(webappUrl)) {
      let url = webappUrl;
      if (intent.kind === 'event') {
        url = `${webappUrl}?tgWebAppStartParam=${encodeURIComponent(`evt_${intent.eventId}`)}`;
      } else if (intent.kind === 'studio-game') {
        url = `${webappUrl}?tgWebAppStartParam=${encodeURIComponent(`game_${intent.projectId}`)}`;
      }

      await context.reply(openAppText, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: studioOnly ? 'Открыть Studio' : 'Open Mini App',
                web_app: { url },
              },
            ],
          ],
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
