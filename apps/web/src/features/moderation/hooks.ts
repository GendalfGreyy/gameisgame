import type {
  CreateReportRequest,
  ReportsListResponse,
  ReviewReportRequest,
} from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useCreateReport() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReportRequest) =>
      apiRequest<{ id: string; status: string }>('/reports', {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
}

export function useAdminReports(enabled: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ['admin', 'reports'],
    enabled: Boolean(token && enabled),
    refetchInterval: 30_000,
    queryFn: () => apiRequest<ReportsListResponse>('/admin/reports', { token }),
  });
}

export function useReviewReport() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, body }: { reportId: string; body: ReviewReportRequest }) =>
      apiRequest<{ id: string; status: string }>(`/admin/reports/${reportId}`, {
        method: 'PATCH',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
}
