import {
  apiErrorBodySchema,
  authResponseSchema,
  createProjectResponseSchema,
  listProjectsResponseSchema,
  meResponseSchema,
  projectDetailSchema,
  projectDraftResponseSchema,
  saveDraftResponseSchema,
  userPreferencesSchema,
  type AuthResponse,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type DevAuthRequest,
  type ErrorCode,
  type ListProjectsResponse,
  type MeResponse,
  type ProjectDetail,
  type ProjectDraftResponse,
  type ProjectTypeDto,
  type SaveDraftRequest,
  type SaveDraftResponse,
  type UpdatePreferencesRequest,
  type UserPreferences,
} from '@tg-creator/shared';
import type { z } from 'zod';

/** `code === null` means the request never got a catalog response (offline, CORS, 5xx proxy). */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | null;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(options: {
    code: ErrorCode | null;
    status: number;
    message: string;
    details?: Record<string, unknown> | undefined;
  }) {
    super(options.message);
    this.name = 'ApiRequestError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз';
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
};

export type ListProjectsParams = {
  cursor?: string | null;
  type?: ProjectTypeDto | null;
  q?: string;
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T extends z.ZodTypeAny>(
    method: string,
    path: string,
    schema: T | null,
    body?: unknown,
  ): Promise<z.output<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const token = options.getToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/api/v1${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiRequestError({
        code: null,
        status: 0,
        message: 'Нет соединения с сервером. Проверьте интернет',
      });
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const parsed = apiErrorBodySchema.safeParse(json);
      if (parsed.success) {
        throw new ApiRequestError({
          code: parsed.data.error.code,
          status: response.status,
          message: parsed.data.error.message,
          details: parsed.data.error.details,
        });
      }
      throw new ApiRequestError({
        code: null,
        status: response.status,
        message: 'Сервер временно недоступен. Попробуйте позже',
      });
    }

    if (schema === null) {
      return undefined;
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiRequestError({
        code: null,
        status: response.status,
        message: 'Сервер вернул неожиданный ответ',
      });
    }
    return parsed.data;
  }

  return {
    loginTelegram: (initData: string): Promise<AuthResponse> =>
      request('POST', '/auth/telegram', authResponseSchema, { initData }),
    loginDev: (input: DevAuthRequest = {}): Promise<AuthResponse> =>
      request('POST', '/auth/dev', authResponseSchema, input),
    logout: (): Promise<void> => request('POST', '/auth/logout', null),
    me: (): Promise<MeResponse> => request('GET', '/me', meResponseSchema),
    updatePreferences: (patch: UpdatePreferencesRequest): Promise<UserPreferences> =>
      request('PATCH', '/me/preferences', userPreferencesSchema, patch),
    listProjects: (params: ListProjectsParams = {}): Promise<ListProjectsResponse> => {
      const search = new URLSearchParams();
      if (params.cursor) {
        search.set('cursor', params.cursor);
      }
      if (params.type) {
        search.set('type', params.type);
      }
      if (params.q?.trim()) {
        search.set('q', params.q.trim());
      }
      const query = search.toString();
      return request('GET', `/projects${query ? `?${query}` : ''}`, listProjectsResponseSchema);
    },
    createProject: (input: CreateProjectRequest): Promise<CreateProjectResponse> =>
      request('POST', '/projects', createProjectResponseSchema, input),
    getProject: (id: string): Promise<ProjectDetail> =>
      request('GET', `/projects/${encodeURIComponent(id)}`, projectDetailSchema),
    getDraft: (id: string): Promise<ProjectDraftResponse> =>
      request('GET', `/projects/${encodeURIComponent(id)}/draft`, projectDraftResponseSchema),
    saveDraft: (id: string, input: SaveDraftRequest): Promise<SaveDraftResponse> =>
      request('PUT', `/projects/${encodeURIComponent(id)}/draft`, saveDraftResponseSchema, input),
    duplicateProject: (id: string): Promise<CreateProjectResponse> =>
      request('POST', `/projects/${encodeURIComponent(id)}/duplicate`, createProjectResponseSchema),
    deleteProject: (id: string): Promise<void> =>
      request('DELETE', `/projects/${encodeURIComponent(id)}`, null),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
