import type {
  FriendRequestsResponse,
  FriendsListResponse,
  SendFriendRequest,
  UserLookup,
} from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { isNotFoundError } from '../../shared/api/errors.js';
import { useAuthStore } from '../auth/store.js';

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useFriends() {
  const token = useToken();
  return useQuery({
    queryKey: ['friends'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<FriendsListResponse>('/friends', { token }),
  });
}

export function useFriendRequests() {
  const token = useToken();
  return useQuery({
    queryKey: ['friends', 'requests'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<FriendRequestsResponse>('/friends/requests', { token }),
  });
}

export function useLookupUser(username: string) {
  const token = useToken();
  const normalized = username.replace(/^@/, '').trim().toLowerCase();
  return useQuery({
    queryKey: ['users', 'lookup', normalized],
    enabled: Boolean(token && normalized.length >= 3),
    retry: false,
    queryFn: async () => {
      try {
        return await apiRequest<UserLookup>(
          `/users/lookup?username=${encodeURIComponent(normalized)}`,
          { token },
        );
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useSendFriendRequest() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SendFriendRequest) =>
      apiRequest<{ id: string; status: string }>('/friends/requests', {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useAcceptFriendRequest() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      apiRequest<{ id: string; status: string }>(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}
