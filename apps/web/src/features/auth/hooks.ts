import type { TelegramAuthResponse, UserProfile } from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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

/** Restore user profile when tokens survived a page reload. */
export function useSessionBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useQuery({
    queryKey: ['auth', 'me'],
    enabled: Boolean(accessToken && !user),
    retry: false,
    queryFn: async () => {
      try {
        const profile = await apiRequest<UserProfile>('/auth/me');
        setUser(profile);
        return profile;
      } catch {
        clearSession();
        throw new Error('Session expired');
      }
    },
  });
}

/** Silent login when opened inside Telegram Mini App. */
export function useAutoTelegramAuth() {
  const user = useAuthStore((state) => state.user);
  const auth = useTelegramAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user || auth.isPending) {
      return;
    }
    if (!getInitData()) {
      return;
    }
    auth.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries();
      },
    });
  }, [user, auth.isPending, auth.mutate, queryClient]);
}
