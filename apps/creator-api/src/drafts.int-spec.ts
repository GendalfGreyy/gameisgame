import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import {
  COMPONENT_DEFAULTS,
  PROJECT_SCHEMA_VERSION,
  projectDocumentSchema,
  type ProjectDocument,
} from '@tg-creator/project-schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../generated/client/index.js';
import { testDatabaseUrl } from './testing/int-global-setup.js';
import { createHttpClient, errorCode, errorDetails } from './testing/http.js';

process.env.NODE_ENV = 'development';
process.env.CREATOR_DEV_AUTH = 'true';
process.env.TELEGRAM_BOT_TOKEN = '123456789:TEST_ONLY_not_a_real_bot_token';
process.env.CREATOR_PROJECT_QUOTA = '10';
process.env.CREATOR_DATABASE_URL = testDatabaseUrl();

let app: INestApplication | undefined;
let baseUrl = '';
const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const { call, loginDev } = createHttpClient(() => baseUrl);

async function start(): Promise<void> {
  const { createApp } = await import('./app.factory.js');
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
}

async function stop(): Promise<void> {
  await app?.close();
  app = undefined;
}

type Draft = { revision: number; document: ProjectDocument };

async function createProject(token: string, type: 'game3d' | 'app' = 'game3d'): Promise<string> {
  const created = await call('POST', '/api/v1/projects', {
    token,
    body: { title: 'Черновик', type, templateId: 'starter' },
  });
  expect(created.status).toBe(201);
  return String(created.body.projectId);
}

async function readDraft(token: string, projectId: string): Promise<Draft> {
  const draft = await call('GET', `/api/v1/projects/${projectId}/draft`, { token });
  expect(draft.status).toBe(200);
  return {
    revision: Number(draft.body.revision),
    document: projectDocumentSchema.parse(draft.body.document),
  };
}

function save(
  token: string,
  projectId: string,
  body: { baseRevision: number; document: unknown; mutationId?: string },
) {
  return call('PUT', `/api/v1/projects/${projectId}/draft`, {
    token,
    body: { mutationId: randomUUID(), ...body },
  });
}

function withCubeAt(document: ProjectDocument, x: number): ProjectDocument {
  const next = structuredClone(document);
  const cube = next.scenes[0]?.entities['entity_cube'];
  const transform = cube?.components.find((component) => component.type === 'transform');
  if (transform?.type !== 'transform') {
    throw new Error('starter has no cube transform');
  }
  transform.data.position = [x, 1, 0];
  return next;
}

beforeAll(start);

afterAll(async () => {
  await stop();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, sessions, projects CASCADE');
});

describe('GET /projects/:id/draft', () => {
  it('returns the latest schema with revision, ETag and savedAt', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const draft = await call('GET', `/api/v1/projects/${projectId}/draft`, { token });
    expect(draft.status).toBe(200);
    expect(draft.body).toMatchObject({ projectId, revision: 1, etag: '"rev-1"' });
    expect(draft.headers.get('etag')).toBe('"rev-1"');
    expect(new Date(String(draft.body.savedAt)).getTime()).not.toBeNaN();
    expect(draft.body.document).toMatchObject({ schemaVersion: PROJECT_SCHEMA_VERSION });
  });

  it('upgrades a stored v1 draft on read', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const owner = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        document: {
          schemaVersion: 1,
          id: projectId,
          ownerId: owner.ownerId,
          title: 'Старый',
          type: 'game3d',
          settings: { orientation: 'auto', quality: 'auto' },
          entrySceneId: 'scene_main',
          scenes: [
            {
              id: 'scene_main',
              name: 'Сцена',
              rootEntityIds: ['entity_box'],
              entities: {
                entity_box: {
                  id: 'entity_box',
                  name: 'Box',
                  parentId: null,
                  childIds: [],
                  enabled: true,
                  components: [
                    { id: 'cmp_mesh', type: 'mesh', enabled: true, data: { primitive: 'box' } },
                  ],
                },
              },
            },
          ],
          pages: [],
          graphs: [],
          assetRefs: [],
          globalVariables: {},
        },
      },
    });
    const draft = await readDraft(token, projectId);
    expect(draft.document.schemaVersion).toBe(2);
    expect(draft.document.scenes[0]?.entities['entity_box']?.components[0]).toEqual({
      id: 'cmp_mesh',
      type: 'mesh',
      enabled: true,
      data: { primitive: 'box', assetId: null },
    });
  });
});

describe('PUT /projects/:id/draft', () => {
  it('saves with baseRevision, bumps the revision and syncs the title', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const draft = await readDraft(token, projectId);
    const next = { ...withCubeAt(draft.document, 4), title: 'Новый мир' };

    const saved = await save(token, projectId, { baseRevision: 1, document: next });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ projectId, revision: 2, etag: '"rev-2"' });
    expect(saved.headers.get('etag')).toBe('"rev-2"');

    const reread = await readDraft(token, projectId);
    expect(reread.revision).toBe(2);
    expect(reread.document).toEqual(next);
    const meta = await call('GET', `/api/v1/projects/${projectId}`, { token });
    expect(meta.body).toMatchObject({ title: 'Новый мир', revision: 2 });
  });

  it('rejects a stale baseRevision with 409 REVISION_CONFLICT', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    expect((await save(token, projectId, { baseRevision: 1, document })).status).toBe(200);

    const stale = await save(token, projectId, {
      baseRevision: 1,
      document: withCubeAt(document, 9),
    });
    expect(stale.status).toBe(409);
    expect(errorCode(stale.body)).toBe('REVISION_CONFLICT');
    expect(errorDetails(stale.body)).toEqual({ expectedRevision: 1, actualRevision: 2 });
    expect((await readDraft(token, projectId)).document).toEqual(document);
  });

  it('two parallel saves on the same baseRevision: one wins, one gets 409', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    const results = await Promise.all(
      [1, 2, 3, 4].map((x) =>
        save(token, projectId, { baseRevision: 1, document: withCubeAt(document, x) }),
      ),
    );
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
    expect((await readDraft(token, projectId)).revision).toBe(2);
  });

  it('a replayed mutationId has no double effect, sequentially and in parallel', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    const body = { baseRevision: 1, document: withCubeAt(document, 2), mutationId: randomUUID() };

    const first = await save(token, projectId, body);
    const retry = await save(token, projectId, body);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    expect((await readDraft(token, projectId)).revision).toBe(2);

    const parallelBody = {
      baseRevision: 2,
      document: withCubeAt(document, 3),
      mutationId: randomUUID(),
    };
    const parallel = await Promise.all([1, 2, 3].map(() => save(token, projectId, parallelBody)));
    expect(parallel.map((result) => result.status)).toEqual([200, 200, 200]);
    expect(new Set(parallel.map((result) => result.body.revision))).toEqual(new Set([3]));
    expect((await readDraft(token, projectId)).revision).toBe(3);
    expect(await prisma.draftMutation.count({ where: { projectId } })).toBe(2);
  });

  it('reusing a mutationId for a different save is 409 MUTATION_ID_REUSED', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    const mutationId = randomUUID();
    await save(token, projectId, { baseRevision: 1, document, mutationId });
    const reused = await save(token, projectId, {
      baseRevision: 2,
      document: withCubeAt(document, 5),
      mutationId,
    });
    expect(reused.status).toBe(409);
    expect(errorCode(reused.body)).toBe('MUTATION_ID_REUSED');
  });

  it('broken parentId → 422 GRAPH_BROKEN_REF; cycle → 422 HIERARCHY_CYCLE; revision unchanged', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);

    const broken = structuredClone(document);
    const cube = broken.scenes[0]?.entities['entity_cube'];
    if (cube) {
      cube.parentId = 'entity_ghost';
    }
    const brokenSave = await save(token, projectId, { baseRevision: 1, document: broken });
    expect(brokenSave.status).toBe(422);
    expect(errorCode(brokenSave.body)).toBe('GRAPH_BROKEN_REF');
    expect(errorDetails(brokenSave.body).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: 'entity_cube', code: 'GRAPH_BROKEN_REF' }),
      ]),
    );

    const cyclic = structuredClone(document);
    const scene = cyclic.scenes[0];
    const ground = scene?.entities['entity_ground'];
    const cyclicCube = scene?.entities['entity_cube'];
    if (!scene || !ground || !cyclicCube) {
      throw new Error('starter changed');
    }
    ground.parentId = 'entity_cube';
    cyclicCube.parentId = 'entity_ground';
    ground.childIds = ['entity_cube'];
    cyclicCube.childIds = ['entity_ground'];
    scene.rootEntityIds = scene.rootEntityIds.filter(
      (id) => id !== 'entity_cube' && id !== 'entity_ground',
    );
    const cyclicSave = await save(token, projectId, { baseRevision: 1, document: cyclic });
    expect(cyclicSave.status).toBe(422);
    expect(errorCode(cyclicSave.body)).toBe('HIERARCHY_CYCLE');

    const duplicate = structuredClone(document);
    duplicate.scenes[0]?.entities['entity_cube']?.components.push({
      id: 'cmp_transform_cube',
      type: 'light',
      enabled: true,
      data: COMPONENT_DEFAULTS.light,
    });
    const duplicateSave = await save(token, projectId, { baseRevision: 1, document: duplicate });
    expect(duplicateSave.status).toBe(422);
    expect(errorCode(duplicateSave.body)).toBe('SCHEMA_INVALID');

    expect((await readDraft(token, projectId)).revision).toBe(1);
  });

  it('rejects untyped data, foreign identity and newer schema versions', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);

    const untyped = await save(token, projectId, {
      baseRevision: 1,
      document: { ...document, settings: { orientation: 'sideways', quality: 'auto' } },
    });
    expect(errorCode(untyped.body)).toBe('SCHEMA_INVALID');

    for (const field of [{ id: randomUUID() }, { ownerId: randomUUID() }, { type: 'game2d' }]) {
      const foreign = await save(token, projectId, {
        baseRevision: 1,
        document: { ...document, ...field },
      });
      expect(foreign.status).toBe(422);
      expect(errorCode(foreign.body)).toBe('SCHEMA_INVALID');
    }

    const future = await save(token, projectId, {
      baseRevision: 1,
      document: { ...document, schemaVersion: 3 },
    });
    expect(future.status).toBe(422);
    expect(errorCode(future.body)).toBe('MIGRATION_FAILED');

    const missing = await call('PUT', `/api/v1/projects/${projectId}/draft`, {
      token,
      body: { document },
    });
    expect(missing.status).toBe(422);
    expect(errorCode(missing.body)).toBe('VALIDATION_FAILED');
    expect((await readDraft(token, projectId)).revision).toBe(1);
  });

  it('oversized documents are 413 DOCUMENT_TOO_LARGE', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    const big = structuredClone(document);
    big.globalVariables = Object.fromEntries(
      Array.from({ length: 1200 }, (_, index) => [
        `v${index}`,
        { type: 'string' as const, value: 'x'.repeat(1990) },
      ]),
    );
    const tooBig = await save(token, projectId, { baseRevision: 1, document: big });
    expect(tooBig.status).toBe(413);
    expect(errorCode(tooBig.body)).toBe('DOCUMENT_TOO_LARGE');

    const overBodyLimit = await call('PUT', `/api/v1/projects/${projectId}/draft`, {
      token,
      rawBody: JSON.stringify({ pad: 'x'.repeat(4 * 1024 * 1024) }),
    });
    expect(overBodyLimit.status).toBe(413);
    expect(errorCode(overBodyLimit.body)).toBe('DOCUMENT_TOO_LARGE');
  });

  it('denies other users (404) and anonymous callers (401)', async () => {
    const owner = await loginDev('8001');
    const stranger = await loginDev('8002');
    const projectId = await createProject(owner);
    const { document } = await readDraft(owner, projectId);

    const foreignRead = await call('GET', `/api/v1/projects/${projectId}/draft`, {
      token: stranger,
    });
    expect(foreignRead.status).toBe(404);
    const foreignWrite = await save(stranger, projectId, { baseRevision: 1, document });
    expect(foreignWrite.status).toBe(404);
    expect(errorCode(foreignWrite.body)).toBe('NOT_FOUND');

    const anonymous = await call('PUT', `/api/v1/projects/${projectId}/draft`, {
      body: { baseRevision: 1, document, mutationId: randomUUID() },
    });
    expect(anonymous.status).toBe(401);
    expect((await readDraft(owner, projectId)).revision).toBe(1);
  });

  it('the saved draft is read back after a server restart', async () => {
    const token = await loginDev('8001');
    const projectId = await createProject(token);
    const { document } = await readDraft(token, projectId);
    const next = withCubeAt(document, 7);
    expect((await save(token, projectId, { baseRevision: 1, document: next })).status).toBe(200);

    await stop();
    await start();

    const reread = await readDraft(token, projectId);
    expect(reread.revision).toBe(2);
    expect(reread.document).toEqual(next);
  });
});
