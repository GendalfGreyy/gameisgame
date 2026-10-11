import { useAuthStore } from '../../features/auth/store.js';
import { ApiError } from './errors.js';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Internal: skip one refresh retry. */
  _retried?: boolean;
};

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, updateAccessToken, clearSession } = useAuthStore.getState();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const data = (await response.json()) as { accessToken: string };
  updateAccessToken(data.accessToken);
  return data.accessToken;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await apiRequestInner<T>(path, options);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        `Не удалось связаться с API (${API_URL}). Проверь, что API и cloudflared-туннель запущены.`,
        0,
      );
    }
    throw error;
  }
}

async function apiRequestInner<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = options.token ?? getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 401 && token && !options._retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequestInner<T>(path, { ...options, token: newToken, _retried: true });
    }
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(
      errorBody?.message ?? `Request failed with ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export { ApiError, isNotFoundError } from './errors.js';
