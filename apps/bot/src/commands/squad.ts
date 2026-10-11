import type { Bot } from 'grammy';

import { botConfig } from '../config.js';

/**
 * /squad <INVITE_CODE> inside a group chat links the chat to the squad.
 * The api posts weekly recaps into linked chats (Monday 10:00).
 */
export function registerSquadCommand(bot: Bot) {
  bot.command('squad', async (context) => {
    const chat = context.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') {
      await context.reply('Эту команду нужно вызвать в групповом чате твоего squad.');
      return;
    }

    const code = context.match?.trim().toUpperCase();
    if (!code) {
      await context.reply('Укажи инвайт-код: /squad ABCD2345\nКод видно в Mini App → My Squad.');
      return;
    }

    if (!botConfig.serviceToken) {
      await context.reply('Привязка squad временно недоступна — сервис не сконфигурирован.');
      return;
    }

    try {
      const response = await fetch(`${botConfig.apiUrl}/internal/squads/link-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${botConfig.serviceToken}`,
        },
        body: JSON.stringify({
          inviteCode: code,
          chatId: String(chat.id),
          chatTitle: 'title' in chat ? chat.title : undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        const message =
          response.status === 404
            ? 'Не нашёл squad с таким кодом. Проверь код в Mini App → My Squad.'
            : response.status === 409
              ? 'Этот чат уже привязан к другому squad.'
              : (body?.message ?? 'Не получилось привязать squad, попробуй позже.');
        await context.reply(message);
        return;
      }

      const result = (await response.json()) as { name: string; memberCount: number };
      await context.reply(
        `Готово! «${result.name}» (${result.memberCount} чел.) привязан к этому чату.\n` +
          'Каждый понедельник в 10:00 пришлю итоги недели squad.',
      );
    } catch {
      await context.reply('API недоступен — попробуй позже.');
    }
  });
}
