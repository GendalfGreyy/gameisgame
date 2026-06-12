import type { InviteLinkResponse } from '@game-is-game/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

export function useInviteLink() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ['auth', 'invite-link'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<InviteLinkResponse>('/auth/invite-link', { token }),
  });
}
