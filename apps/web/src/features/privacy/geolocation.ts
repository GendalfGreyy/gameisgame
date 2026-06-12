import { create } from 'zustand';

import { obfuscateCoordinates } from '@game-is-game/shared';

import { useAuthStore } from '../../features/auth/store.js';

export type GeoPosition = { lat: number; lng: number };

type GeoState = {
  position: GeoPosition | null;
  error: string | null;
  refresh: () => void;
};

export const useGeolocationStore = create<GeoState>((set) => {
  const request = () => {
    if (!('geolocation' in navigator)) {
      set({ error: 'Геолокация недоступна на этом устройстве' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const privacyMode = useAuthStore.getState().user?.privacyMode ?? 'approximate';
        const coords = obfuscateCoordinates(
          result.coords.latitude,
          result.coords.longitude,
          privacyMode,
        );
        set({
          position: coords,
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

export function useGeolocation(): GeoState {
  return useGeolocationStore();
}
