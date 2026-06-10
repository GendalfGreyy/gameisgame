import type {
  CheckInResponse,
  ConfirmDwellRequest,
  CreateCheckInRequest,
  EventDetail,
  NearbyEventsResponse,
  QrTokenResponse,
  StartingSoonResponse,
} from '@game-is-game/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

export type GeoPosition = { lat: number; lng: number };

function useToken() {
  return useAuthStore((state) => state.accessToken);
}

export function useNearbyEvents(position: GeoPosition | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['events', 'nearby', position?.lat, position?.lng],
    enabled: Boolean(token && position),
    refetchInterval: 60_000,
    queryFn: () =>
      apiRequest<NearbyEventsResponse>(
        `/events/nearby?lat=${position?.lat}&lng=${position?.lng}`,
        { token },
      ),
  });
}

export function useStartingSoon(position: GeoPosition | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['events', 'starting-soon', position?.lat, position?.lng],
    enabled: Boolean(token && position),
    refetchInterval: 60_000,
    queryFn: () =>
      apiRequest<StartingSoonResponse>(
        `/events/starting-soon?lat=${position?.lat}&lng=${position?.lng}`,
        { token },
      ),
  });
}

export function useEventDetail(eventId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['events', 'detail', eventId],
    enabled: Boolean(token && eventId),
    queryFn: () => apiRequest<EventDetail>(`/events/${eventId}`, { token }),
  });
}

export function useJoinEvent(eventId: string) {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ eventId: string; joinedAt: string }>(`/events/${eventId}/join`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
    },
  });
}

export function useCheckIn(eventId: string) {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCheckInRequest) =>
      apiRequest<CheckInResponse>(`/events/${eventId}/checkin`, {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
    },
  });
}

export function useConfirmDwell(eventId: string) {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmDwellRequest) =>
      apiRequest<CheckInResponse>(`/events/${eventId}/checkin/confirm`, {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
    },
  });
}

/** Rotating host QR token: refetches exactly when the current token expires. */
export function useHostQrToken(eventId: string, enabled: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ['events', 'qr-token', eventId],
    enabled: Boolean(token && enabled),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data ? Math.max(data.expiresInSeconds, 1) * 1000 : 5000;
    },
    queryFn: () =>
      apiRequest<QrTokenResponse>(`/events/${eventId}/checkin/qr-token`, { token }),
  });
}

export function useGeolocation(): {
  position: GeoPosition | null;
  error: string | null;
  refresh: () => void;
} {
  return geoStore();
}

type GeoState = {
  position: GeoPosition | null;
  error: string | null;
  refresh: () => void;
};

const geoStore = create<GeoState>((set) => {
  const request = () => {
    if (!('geolocation' in navigator)) {
      set({ error: 'Геолокация недоступна на этом устройстве' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        set({
          position: { lat: result.coords.latitude, lng: result.coords.longitude },
          error: null,
        });
      },
      () => {
        set({ error: 'Не получилось определить локацию — разреши доступ и обнови' });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  request();

  return {
    position: null,
    error: null,
    refresh: request,
  };
});
