import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '../generated/client/index.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { testDatabaseUrl } from './testing/int-global-setup.js';
import { buildDataCheckString, signDataCheckString } from './auth/telegram-init-data.js';

const BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_bot_token';
const QUOTA = 3;

process.env.NODE_ENV = 'development';
process.env.CREATOR_DEV_AUTH = 'true';
process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
process.env.CREATOR_PROJECT_QUOTA = String(QUOTA);
process.env.CREATOR_AUTH_MAX_AGE_SECONDS = '3600';
process.env.CREATOR_DATABASE_URL = testDatabaseUrl();

let app: INestApplication;
let baseUrl: string;
const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

type Json = Record<string, unknown>;

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : {};
  return {
    status: response.status,
    body: typeof body === 'object' && body !== null ? (body as Json) : {},
  };
}

function errorCode(body: Json): unknown {
  const error = body.error;
  return typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
}

function signedInitData(userId: number, authDate: number, token = BOT_TOKEN): string {
  const params = new URLSearchParams({
    query_id: 'AAE-test',
    user: JSON.stringify({ id: userId, first_name: 'Тест', username: `u${userId}` }),
    auth_date: String(authDate),
  });
  params.set('hash', signDataCheckString(buildDataCheckString(params), token));
  return params.toString();
}

async function loginDev(telegramId: string): Promise<string> {
  const { status, body } = await call('POST', '/api/v1/auth/dev', {
    body: { telegramId, firstName: `User ${telegramId}` },
  });
  expect(status).toBe(200);
  return String(body.token);
}

beforeAll(async () => {
  const { createApp } = await import('./app.factory.js');
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  baseUrl = baseUrl.replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, projects CASCADE');
});

describe('POST /api/v1/auth/telegram', () => {
  const now = () => Math.floor(Date.now() / 1000);

  it('accepts valid initData and returns a working session', async () => {
    const login = await call('POST', '/api/v1/auth/telegram', {
      body: { initData: signedInitData(5001, now()) },
    });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ telegramId: '5001', firstName: 'Тест' });

    const me = await call('GET', '/api/v1/me', { token: String(login.body.token) });
    expect(me.status).toBe(200);
    expect(me.body.preferences).toEqual({ theme: 'telegram', density: 'comfortable' });
    expect(me.body.quotas).toEqual({ projects: { used: 0, limit: QUOTA } });
  });

  it('rejects a wrong hash with 401 AUTH_INVALID_SIGNATURE', async () => {
    const forged = signedInitData(5001, now(), '987654321:another_fake_token');
    const response = await call('POST', '/api/v1/auth/telegram', { body: { initData: forged } });
    expect(response.status).toBe(401);
    expect(errorCode(response.body)).toBe('AUTH_INVALID_SIGNATURE');
  });

  it('rejects an old auth_date with 401 AUTH_EXPIRED', async () => {
    const stale = signedInitData(5001, now() - 7200);
    const response = await call('POST', '/api/v1/auth/telegram', { body: { initData: stale } });
    expect(response.status).toBe(401);
    expect(errorCode(response.body)).toBe('AUTH_EXPIRED');
  });

  it('rejects a malformed body with 422 VALIDATION_FAILED', async () => {
    const response = await call('POST', '/api/v1/auth/telegram', { body: { initData: 42 } });
    expect(response.status).toBe(422);
    expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
  });
});

describe('sessions', () => {
  it('denies protected routes without a valid session', async () => {
    expect((await call('GET', '/api/v1/me')).status).toBe(401);
    const bogus = await call('GET', '/api/v1/projects', { token: 'tgc_nope' });
    expect(bogus.status).toBe(401);
    expect(errorCode(bogus.body)).toBe('SESSION_EXPIRED');
  });

  it('revokes the session on logout', async () => {
    const token = await loginDev('7001');
    expect((await call('POST', '/api/v1/auth/logout', { token })).status).toBe(204);
    expect(errorCode((await call('GET', '/api/v1/me', { token })).body)).toBe('SESSION_EXPIRED');
  });

  it('keeps health public', async () => {
    expect((await call('GET', '/api/v1/health')).status).toBe(200);
  });
});

describe('projects', () => {
  it('creates a project that survives a fresh read (refresh)', async () => {
    const token = await loginDev('7001');
    const created = await call('POST', '/api/v1/projects', {
      token,
      body: { title: '  Мой мир  ', type: 'game3d', templateId: 'starter' },
    });
    expect(created.status).toBe(201);
    expect(created.body.revision).toBe(1);
    const projectId = String(created.body.projectId);

    const list = await call('GET', '/api/v1/projects', { token });
    expect(list.body.items).toEqual([expect.objectContaining({ id: projectId, title: 'Мой мир' })]);

    const draft = await call('GET', `/api/v1/projects/${projectId}/draft`, { token });
    expect(draft.status).toBe(200);
    expect(draft.body.document).toMatchObject({ id: projectId, schemaVersion: 1, type: 'game3d' });
  });

  it('hides project A from user B as NOT_FOUND', async () => {
    const tokenA = await loginDev('7001');
    const tokenB = await loginDev('7002');
    const created = await call('POST', '/api/v1/projects', {
      token: tokenA,
      body: { title: 'Секрет A', type: 'app' },
    });
    const projectId = String(created.body.projectId);

    expect((await call('GET', '/api/v1/projects', { token: tokenB })).body.items).toEqual([]);
    for (const [method, path] of [
      ['GET', `/api/v1/projects/${projectId}`],
      ['GET', `/api/v1/projects/${projectId}/draft`],
      ['POST', `/api/v1/projects/${projectId}/duplicate`],
      ['DELETE', `/api/v1/projects/${projectId}`],
    ] as const) {
      const response = await call(method, path, { token: tokenB });
      expect(response.status).toBe(404);
      expect(errorCode(response.body)).toBe('NOT_FOUND');
    }
    expect((await call('GET', `/api/v1/projects/${projectId}`, { token: tokenA })).status).toBe(
      200,
    );
  });

  it('duplicates, soft-deletes and enforces the quota', async () => {
    const token = await loginDev('7001');
    const created = await call('POST', '/api/v1/projects', {
      token,
      body: { title: 'Оригинал', type: 'game2d' },
    });
    const projectId = String(created.body.projectId);

    const copy = await call('POST', `/api/v1/projects/${projectId}/duplicate`, { token });
    expect(copy.status).toBe(201);
    expect(copy.body.project).toMatchObject({ title: 'Оригинал (копия)', type: 'game2d' });

    await call('POST', '/api/v1/projects', { token, body: { title: 'Третий', type: 'app' } });
    const overQuota = await call('POST', '/api/v1/projects', {
      token,
      body: { title: 'Четвёртый', type: 'app' },
    });
    expect(overQuota.status).toBe(429);
    expect(errorCode(overQuota.body)).toBe('QUOTA_EXCEEDED');

    expect((await call('DELETE', `/api/v1/projects/${projectId}`, { token })).status).toBe(204);
    expect((await call('GET', `/api/v1/projects/${projectId}`, { token })).status).toBe(404);
    const me = await call('GET', '/api/v1/me', { token });
    expect(me.body.quotas).toEqual({ projects: { used: 2, limit: QUOTA } });
  });

  it('paginates with a keyset cursor and filters by type and query', async () => {
    const token = await loginDev('7001');
    for (const [title, type] of [
      ['Альфа', 'game3d'],
      ['Бета', 'app'],
      ['Гамма', 'game3d'],
    ] as const) {
      await call('POST', '/api/v1/projects', { token, body: { title, type } });
    }
    const first = await call('GET', '/api/v1/projects?limit=2', { token });
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await call(
      'GET',
      `/api/v1/projects?limit=2&cursor=${String(first.body.nextCursor)}`,
      { token },
    );
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const only3d = await call('GET', '/api/v1/projects?type=game3d', { token });
    expect(only3d.body.items).toHaveLength(2);
    const search = await call('GET', `/api/v1/projects?q=${encodeURIComponent('бет')}`, { token });
    expect(search.body.items).toEqual([expect.objectContaining({ title: 'Бета' })]);
  });

  it('rejects invalid input with VALIDATION_FAILED', async () => {
    const token = await loginDev('7001');
    const response = await call('POST', '/api/v1/projects', {
      token,
      body: { title: '', type: 'game3d' },
    });
    expect(response.status).toBe(422);
    expect(errorCode(response.body)).toBe('VALIDATION_FAILED');
  });
});

describe('PATCH /api/v1/me/preferences', () => {
  it('persists theme and density per user', async () => {
    const token = await loginDev('7001');
    const patched = await call('PATCH', '/api/v1/me/preferences', {
      token,
      body: { theme: 'light' },
    });
    expect(patched.body).toEqual({ theme: 'light', density: 'comfortable' });
    await call('PATCH', '/api/v1/me/preferences', { token, body: { density: 'compact' } });
    const me = await call('GET', '/api/v1/me', { token });
    expect(me.body.preferences).toEqual({ theme: 'light', density: 'compact' });

    const invalid = await call('PATCH', '/api/v1/me/preferences', {
      token,
      body: { theme: 'neon' },
    });
    expect(invalid.status).toBe(422);
  });
});
