import type { TelegramAuthResponse } from '@game-is-game/shared';
import { useMutation } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { getInitData } from '../../shared/lib/telegram.js';
import { useAuthStore } from './store.js';

export function useTelegramAuth() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async () => {
      const initData = getInitData();
      if (!initData) {
        throw new Error('Telegram initData is unavailable outside Telegram');
      }

      return apiRequest<TelegramAuthResponse>('/auth/telegram', {
        method: 'POST',
        body: { initData },
      });
    },
    onSuccess: (response) => {
      setSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      });
    },
  });
}
