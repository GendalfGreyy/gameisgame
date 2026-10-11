import type { MeResponse } from '@tg-creator/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiRequestError, createApiClient, errorMessage, type ApiClient } from '../lib/api.js';
import { readStored, STORAGE_KEYS, writeStored } from '../lib/storage.js';
import { telegram } from '../lib/telegram.js';
import { useTheme } from './theme.js';

export const API_BASE_URL = import.meta.env.VITE_CREATOR_API_URL || 'http://localhost:3010';

/** UI hint only — the API refuses dev auth unless NODE_ENV=development. */
export const DEV_AUTH_UI = import.meta.env.DEV || import.meta.env.VITE_CREATOR_DEV_AUTH === 'true';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason: 'outsideTelegram' | 'loggedOut' | 'expired' }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: MeResponse };

type AuthContextValue = {
  state: AuthState;
  api: ApiClient;
  me: MeResponse | null;
  retry: () => void;
  loginDev: (telegramId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Runs an API call; on SESSION_EXPIRED re-authenticates once (inside Telegram) and retries. */
  withSession: <T>(call: (api: ApiClient) => Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const tokenRef = useRef<string | null>(readStored(STORAGE_KEYS.session));
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const api = useMemo(
    () => createApiClient({ baseUrl: API_BASE_URL, getToken: () => tokenRef.current }),
    [],
  );

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
    writeStored(STORAGE_KEYS.session, token);
  }, []);

  const loadMe = useCallback(async () => {
    const me = await api.me();
    theme.hydrate(me.preferences);
    setState({ status: 'ready', me });
  }, [api, theme.hydrate]);

  const signInWithTelegram = useCallback(async () => {
    const result = await api.loginTelegram(telegram().initData);
    setToken(result.token);
  }, [api, setToken]);

  useEffect(() => {
    let cancelled = false;
    const tg = telegram();
    tg.ready();
    tg.expand();

    async function start() {
      setState({ status: 'loading' });
      try {
        if (tg.isTelegram) {
          // initData is re-verified on every launch; a stored token is never trusted over it.
          await signInWithTelegram();
        } else if (!tokenRef.current) {
          setState({ status: 'signedOut', reason: 'outsideTelegram' });
          return;
        }
        if (!cancelled) {
          await loadMe();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiRequestError && error.code === 'SESSION_EXPIRED') {
          setToken(null);
          setState({ status: 'signedOut', reason: 'expired' });
          return;
        }
        setState({ status: 'error', message: errorMessage(error) });
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [attempt, loadMe, setToken, signInWithTelegram]);

  const withSession = useCallback(
    async <T,>(call: (client: ApiClient) => Promise<T>): Promise<T> => {
      try {
        return await call(api);
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.code !== 'SESSION_EXPIRED') {
          throw error;
        }
        if (telegram().isTelegram) {
          await signInWithTelegram();
          return call(api);
        }
        setToken(null);
        setState({ status: 'signedOut', reason: 'expired' });
        throw error;
      }
    },
    [api, setToken, signInWithTelegram],
  );

  const loginDev = useCallback(
    async (telegramId?: string) => {
      setState({ status: 'loading' });
      try {
        const result = await api.loginDev(telegramId ? { telegramId } : {});
        setToken(result.token);
        await loadMe();
      } catch (error) {
        setState({ status: 'error', message: errorMessage(error) });
      }
    },
    [api, loadMe, setToken],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The local token is dropped regardless; the server session expires on its own.
    }
    setToken(null);
    setState({ status: 'signedOut', reason: 'loggedOut' });
  }, [api, setToken]);

  const refreshMe = useCallback(async () => {
    const me = await withSession((client) => client.me());
    setState({ status: 'ready', me });
  }, [withSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      api,
      me: state.status === 'ready' ? state.me : null,
      retry: () => setAttempt((value) => value + 1),
      loginDev,
      logout,
      refreshMe,
      withSession,
    }),
    [state, api, loginDev, logout, refreshMe, withSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

/** Narrowed accessor for screens rendered only after sign-in. */
export function useMe(): MeResponse {
  const { me } = useAuth();
  if (!me) {
    throw new Error('useMe used before sign-in');
  }
  return me;
}
