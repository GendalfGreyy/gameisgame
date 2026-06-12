import type { PrivacyMode, UpdateUserSettings, UserProfile } from '@game-is-game/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useUpdatePrivacyMode() {
  const token = useToken();
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (privacyMode: PrivacyMode) =>
      apiRequest<UserProfile>('/users/me/settings', {
        method: 'PATCH',
        body: { privacyMode } satisfies UpdateUserSettings,
        token,
      }),
    onSuccess: (profile) => {
      setUser(profile);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
