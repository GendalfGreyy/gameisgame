import { themePreferenceSchema, densitySchema } from '@tg-creator/shared';
import { DENSITIES, THEME_PREFERENCES } from '@tg-creator/ui-kit';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError, createApiClient } from './api.js';
import { parseRoute, routePath } from './router.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('sends the bearer token and parses typed responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { theme: 'light', density: 'compact' }));
    const api = createApiClient({ baseUrl: 'http://api/', getToken: () => 'tgc_x', fetchImpl });
    await expect(api.updatePreferences({ theme: 'light' })).resolves.toEqual({
      theme: 'light',
      density: 'compact',
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://api/api/v1/me/preferences');
    expect(init?.method).toBe('PATCH');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tgc_x');
  });

  it('surfaces catalog error codes with the Russian message', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(429, {
        error: { code: 'QUOTA_EXCEEDED', message: 'Достигнут лимит проектов (3)' },
      }),
    );
    const api = createApiClient({ baseUrl: 'http://api', getToken: () => null, fetchImpl });
    const error: unknown = await api
      .createProject({ title: 'X', type: 'app' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: 'QUOTA_EXCEEDED', status: 429 });
  });

  it('maps network failures and non-catalog bodies to code null', async () => {
    const offline = createApiClient({
      baseUrl: 'http://api',
      getToken: () => null,
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    await expect(offline.me()).rejects.toMatchObject({ code: null, status: 0 });

    const proxy = createApiClient({
      baseUrl: 'http://api',
      getToken: () => null,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 502 })),
    });
    await expect(proxy.me()).rejects.toMatchObject({ code: null, status: 502 });
  });

  it('saves a draft with baseRevision and surfaces 409 conflict details', async () => {
    const saved = {
      projectId: 'p1',
      revision: 2,
      etag: '"rev-2"',
      savedAt: '2026-10-11T12:00:00.000Z',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, saved))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          error: {
            code: 'REVISION_CONFLICT',
            message: 'Черновик изменён в другом месте',
            details: { expectedRevision: 1, actualRevision: 2 },
          },
        }),
      );
    const api = createApiClient({ baseUrl: 'http://api', getToken: () => 'tgc_x', fetchImpl });
    const input = { baseRevision: 1, mutationId: 'mut_00000001', document: { any: 'thing' } };
    await expect(api.saveDraft('p1', input)).resolves.toEqual(saved);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('http://api/api/v1/projects/p1/draft');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(input);

    await expect(api.saveDraft('p1', input)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      status: 409,
      details: { expectedRevision: 1, actualRevision: 2 },
    });
  });

  it('rejects responses that do not match the contract', async () => {
    const api = createApiClient({
      baseUrl: 'http://api',
      getToken: () => null,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { nope: true })),
    });
    await expect(api.me()).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe('router', () => {
  it('parses known routes and round-trips paths', () => {
    expect(parseRoute('/')).toEqual({ name: 'dashboard' });
    expect(parseRoute('/settings/')).toEqual({ name: 'settings' });
    expect(parseRoute('/new', '?type=game2d')).toEqual({ name: 'wizard', type: 'game2d' });
    expect(parseRoute('/new', '?type=evil')).toEqual({ name: 'wizard' });
    expect(parseRoute('/projects/abc')).toEqual({ name: 'project', projectId: 'abc' });
    expect(parseRoute('/nope')).toEqual({ name: 'notFound' });
    expect(routePath({ name: 'project', projectId: 'a b' })).toBe('/projects/a%20b');
  });
});

describe('theme contract', () => {
  it('ui-kit and API share the same preference values', () => {
    expect([...THEME_PREFERENCES]).toEqual(themePreferenceSchema.options);
    expect([...DENSITIES]).toEqual(densitySchema.options);
  });
});
