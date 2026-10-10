import type {
  CreateStudioProjectRequest,
  PublishStudioProjectResponse,
  StudioProjectDetail,
  StudioProjectListResponse,
  UpdateStudioProjectRequest,
} from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useStudioProjects() {
  const token = useToken();
  return useQuery({
    queryKey: ['studio', 'projects'],
    enabled: Boolean(token),
    queryFn: () => apiRequest<StudioProjectListResponse>('/studio/projects', { token }),
  });
}

export function useStudioProject(projectId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['studio', 'project', projectId],
    enabled: Boolean(token && projectId),
    queryFn: () => apiRequest<StudioProjectDetail>(`/studio/projects/${projectId}`, { token }),
  });
}

export function usePublishedStudioGame(projectId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['studio', 'play', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiRequest<StudioProjectDetail>(`/studio/play/${projectId}`, { token }),
  });
}

export function useCreateStudioProject() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStudioProjectRequest) =>
      apiRequest<StudioProjectDetail>('/studio/projects', {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['studio', 'projects'] });
    },
  });
}

export function useUpdateStudioProject(projectId: string) {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStudioProjectRequest) =>
      apiRequest<StudioProjectDetail>(`/studio/projects/${projectId}`, {
        method: 'PATCH',
        body,
        token,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['studio', 'project', projectId], data);
      void queryClient.invalidateQueries({ queryKey: ['studio', 'projects'] });
    },
  });
}

export function usePublishStudioProject(projectId: string) {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<PublishStudioProjectResponse>(`/studio/projects/${projectId}/publish`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['studio', 'project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['studio', 'projects'] });
    },
  });
}

export function useDeleteStudioProject() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<{ ok: true }>(`/studio/projects/${projectId}`, {
        method: 'DELETE',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['studio', 'projects'] });
    },
  });
}

export function useRecordStudioPlay(projectId: string) {
  const token = useToken();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ playCount: number }>(`/studio/projects/${projectId}/play`, {
        method: 'POST',
        token,
      }),
  });
}
