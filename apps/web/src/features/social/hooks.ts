import type {
  CreateSquadRequest,
  JoinSquadRequest,
  LeaderboardResponse,
  SquadDetail,
  SquadLeaderboardResponse,
} from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { isNotFoundError } from '../../shared/api/errors.js';
import { useAuthStore } from '../auth/store.js';

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useLeaderboard() {
  const token = useToken();
  return useQuery({
    queryKey: ['leaderboard'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<LeaderboardResponse>('/leaderboard', { token }),
  });
}

export function useSquadLeaderboard() {
  const token = useToken();
  return useQuery({
    queryKey: ['squads', 'leaderboard'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<SquadLeaderboardResponse>('/squads/leaderboard', { token }),
  });
}

export function useMySquad() {
  const token = useToken();
  return useQuery({
    queryKey: ['squads', 'me'],
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<SquadDetail | null> => {
      try {
        return await apiRequest<SquadDetail>('/squads/me', { token });
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useCreateSquad() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSquadRequest) =>
      apiRequest<SquadDetail>('/squads', { method: 'POST', body, token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

export function useJoinSquad() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: JoinSquadRequest) =>
      apiRequest<SquadDetail>('/squads/join', { method: 'POST', body, token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

export function useLeaveSquad() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ left: boolean }>('/squads/me', { method: 'DELETE', token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

export type StreakSummary = {
  streakWeeks: number;
  freezeTokens: number;
  lastActiveWeek: string | null;
};

export function useMyStreak() {
  const token = useToken();
  return useQuery({
    queryKey: ['streaks', 'me'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<StreakSummary>('/streaks/me', { token }),
  });
}
