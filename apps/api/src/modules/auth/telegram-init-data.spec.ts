import { sign } from '@telegram-apps/init-data-node';
import { describe, expect, it } from 'vitest';

import { validateTelegramInitData } from './telegram-init-data.js';

describe('validateTelegramInitData', () => {
  it('accepts init data signed by the bot token', () => {
    const botToken = '123456:ABCDEF';
    const initData = sign(
      {
        user: {
          id: 42,
          first_name: 'Alex',
          username: 'alex_dev',
        },
      },
      botToken,
      new Date(),
    );

    const parsed = validateTelegramInitData(initData, botToken);
    expect(parsed.user.id).toBe(42);
    expect(parsed.user.first_name).toBe('Alex');
  });

  it('rejects tampered payloads', () => {
    const botToken = '123456:ABCDEF';
    const initData = sign(
      {
        user: {
          id: 42,
          first_name: 'Alex',
        },
      },
      botToken,
      new Date(),
    );

    expect(() => validateTelegramInitData(`${initData}&extra=1`, botToken)).toThrow();
  });
});
