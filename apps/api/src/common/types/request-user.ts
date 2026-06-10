import type { UserRole } from '@game-is-game/shared';

export type RequestUser = {
  id: string;
  telegramId: string;
  role: UserRole;
};
