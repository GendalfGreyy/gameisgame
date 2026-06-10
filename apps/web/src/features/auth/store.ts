import type { UserProfile } from '@game-is-game/shared';
import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setSession: (params: {
    accessToken: string;
    refreshToken: string;
    user: UserProfile;
  }) => void;
  clearSession: () => void;
};

const ACCESS_TOKEN_KEY = 'gig.accessToken';
const REFRESH_TOKEN_KEY = 'gig.refreshToken';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: sessionStorage.getItem(ACCESS_TOKEN_KEY),
  refreshToken: sessionStorage.getItem(REFRESH_TOKEN_KEY),
  user: null,
  setSession: ({ accessToken, refreshToken, user }) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken, user });
  },
  clearSession: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
