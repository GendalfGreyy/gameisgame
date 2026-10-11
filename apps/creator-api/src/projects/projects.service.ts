import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cloneProjectDocument,
  createProjectDocument,
  parseProjectDocument,
  serializeProjectDocument,
  type DocumentIssue,
  type ParseFailure,
  type ProjectDocument,
} from '@tg-creator/project-schema';
import {
  ApiError,
  DRAFT_MAX_BYTES,
  PROJECT_TITLE_MAX,
  draftEtag,
  type ListProjectsResponse,
  type ProjectDraftResponse,
  type ProjectSummary,
  type SaveDraftRequest,
  type SaveDraftResponse,
} from '@tg-creator/shared';
import { z } from 'zod';

import { Prisma, type DraftMutation, type Project } from '../../generated/client/index.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type CreateProjectInput = {
  title: string;
  type: Project['type'];
  templateId: 'empty' | 'starter';
  orientation: 'auto' | 'portrait' | 'landscape';
};

export type ListProjectsInput = {
  cursor?: string | undefined;
  type?: Project['type'] | undefined;
  q?: string | undefined;
  limit: number;
};

const uuidSchema = z.string().uuid();

function notFound(): ApiError {
  return new ApiError({ code: 'NOT_FOUND', message: 'Проект не найден' });
}

export function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    status: project.status,
    revision: project.revision,
    createdAt: project.createdAt.toISOString(),
    lastEditedAt: project.updatedAt.toISOString(),
  };
}

type Cursor = { updatedAt: Date; id: string };

export function encodeCursor(project: Pick<Project, 'updatedAt' | 'id'>): string {
  return Buffer.from(`${project.updatedAt.toISOString()}|${project.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): Cursor {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const updatedAt = new Date(iso ?? '');
  if (Number.isNaN(updatedAt.getTime()) || !uuidSchema.safeParse(id).success || !id) {
    throw new ApiError({ code: 'VALIDATION_FAILED', message: 'Некорректный курсор страницы' });
  }
  return { updatedAt, id };
}

/** A serialized ProjectDocument is plain JSON by construction, which is what Prisma stores. */
function toJsonDocument(document: ProjectDocument): Prisma.InputJsonValue {
  return JSON.parse(serializeProjectDocument(document)) as Prisma.InputJsonValue;
}

const DOCUMENT_ERROR_MESSAGES: Record<ParseFailure['code'], string> = {
  SCHEMA_INVALID: 'Документ проекта не прошёл проверку схемы',
  GRAPH_BROKEN_REF: 'В документе есть ссылка на несуществующий объект',
  HIERARCHY_CYCLE: 'В иерархии объектов есть цикл',
  MIGRATION_FAILED: 'Версия документа не поддерживается',
};

function documentError(failure: ParseFailure): ApiError {
  return new ApiError({
    code: failure.code,
    message: DOCUMENT_ERROR_MESSAGES[failure.code],
    details: { issues: failure.issues },
  });
}

/** Stored drafts may be older schema versions; they are upgraded on read. */
function readStoredDocument(project: Project): ProjectDocument {
  const parsed = parseProjectDocument(project.document);
  if (!parsed.ok) {
    throw documentError(parsed);
  }
  return parsed.document;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function savedResult(projectId: string, revision: number, savedAt: Date): SaveDraftResponse {
  return { projectId, revision, etag: draftEtag(revision), savedAt: savedAt.toISOString() };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function copyTitle(title: string): string {
  const suffix = ' (копия)';
  return `${title.slice(0, PROJECT_TITLE_MAX - suffix.length)}${suffix}`;
}

/**
 * Every query is scoped by `ownerId` from the server session. Other users'
 * projects are indistinguishable from missing ones (docs/04 §10.2).
 */
@Injectable()
export class ProjectsService {
  private readonly prisma: PrismaService;
  private readonly quota: number;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.quota = config.get('CREATOR_PROJECT_QUOTA', { infer: true });
  }

  get projectQuota(): number {
    return this.quota;
  }

  countActive(ownerId: string): Promise<number> {
    return this.prisma.project.count({ where: { ownerId, deletedAt: null } });
  }

  async list(ownerId: string, input: ListProjectsInput): Promise<ListProjectsResponse> {
    const where: Prisma.ProjectWhereInput = { ownerId, deletedAt: null };
    if (input.type) {
      where.type = input.type;
    }
    if (input.q) {
      where.title = { contains: input.q, mode: 'insensitive' };
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      where.OR = [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ];
    }
    const rows = await this.prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map(toSummary),
      nextCursor: rows.length > input.limit && last ? encodeCursor(last) : null,
    };
  }

  async get(ownerId: string, projectId: string): Promise<Project> {
    if (!uuidSchema.safeParse(projectId).success) {
      throw notFound();
    }
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId, deletedAt: null },
    });
    if (!project) {
      throw notFound();
    }
    return project;
  }

  async getDraft(ownerId: string, projectId: string): Promise<ProjectDraftResponse> {
    const project = await this.get(ownerId, projectId);
    return {
      projectId: project.id,
      revision: project.revision,
      etag: draftEtag(project.revision),
      savedAt: project.updatedAt.toISOString(),
      document: readStoredDocument(project),
    };
  }

  /**
   * Optimistic save (docs/04 §3): compare-and-swap on `revision` inside a transaction,
   * idempotent per `mutationId`. A rejected save leaves the stored draft untouched.
   */
  async saveDraft(
    ownerId: string,
    projectId: string,
    input: SaveDraftRequest,
  ): Promise<SaveDraftResponse> {
    const project = await this.get(ownerId, projectId);

    const parsed = parseProjectDocument(input.document);
    if (!parsed.ok) {
      throw documentError(parsed);
    }
    const document = parsed.document;
    const identityIssues: DocumentIssue[] = [];
    if (document.id !== project.id) {
      identityIssues.push({
        code: 'SCHEMA_INVALID',
        path: ['id'],
        message: 'ID документа не совпадает с проектом',
      });
    }
    if (document.ownerId !== ownerId) {
      identityIssues.push({
        code: 'SCHEMA_INVALID',
        path: ['ownerId'],
        message: 'Владелец документа не совпадает с проектом',
      });
    }
    if (document.type !== project.type) {
      identityIssues.push({
        code: 'SCHEMA_INVALID',
        path: ['type'],
        message: 'Тип проекта нельзя изменить',
      });
    }
    if (identityIssues.length > 0) {
      throw documentError({ ok: false, code: 'SCHEMA_INVALID', issues: identityIssues });
    }

    const serialized = JSON.stringify(document);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > DRAFT_MAX_BYTES) {
      throw new ApiError({
        code: 'DOCUMENT_TOO_LARGE',
        message: 'Проект слишком большой для сохранения. Удалите лишние объекты',
        details: { limitBytes: DRAFT_MAX_BYTES, actualBytes: bytes },
      });
    }
    const documentHash = sha256(serialized);

    const replay = await this.replayMutation(projectId, input, documentHash);
    if (replay) {
      return replay;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.project.updateMany({
          where: { id: projectId, ownerId, deletedAt: null, revision: input.baseRevision },
          data: {
            document: JSON.parse(serialized) as Prisma.InputJsonValue,
            title: document.title,
            revision: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          const current = await tx.project.findFirst({
            where: { id: projectId, ownerId, deletedAt: null },
            select: { revision: true },
          });
          if (!current) {
            throw notFound();
          }
          throw new ApiError({
            code: 'REVISION_CONFLICT',
            message: 'Проект уже изменён на другом устройстве. Обновите черновик',
            details: { expectedRevision: input.baseRevision, actualRevision: current.revision },
          });
        }
        const saved = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { revision: true, updatedAt: true },
        });
        await tx.draftMutation.create({
          data: {
            projectId,
            mutationId: input.mutationId,
            baseRevision: input.baseRevision,
            documentHash,
            revision: saved.revision,
            savedAt: saved.updatedAt,
          },
        });
        return savedResult(projectId, saved.revision, saved.updatedAt);
      });
    } catch (error) {
      // A concurrent retry with the same mutationId may have committed first.
      const conflict = error instanceof ApiError && error.code === 'REVISION_CONFLICT';
      if (conflict || isUniqueViolation(error)) {
        const winner = await this.replayMutation(projectId, input, documentHash);
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  private async replayMutation(
    projectId: string,
    input: SaveDraftRequest,
    documentHash: string,
  ): Promise<SaveDraftResponse | null> {
    const previous: DraftMutation | null = await this.prisma.draftMutation.findUnique({
      where: { projectId_mutationId: { projectId, mutationId: input.mutationId } },
    });
    if (!previous) {
      return null;
    }
    if (previous.documentHash !== documentHash || previous.baseRevision !== input.baseRevision) {
      throw new ApiError({
        code: 'MUTATION_ID_REUSED',
        message: 'Этот mutationId уже использован для другого сохранения',
        details: { revision: previous.revision },
      });
    }
    return savedResult(projectId, previous.revision, previous.savedAt);
  }

  async create(ownerId: string, input: CreateProjectInput): Promise<Project> {
    await this.assertQuota(ownerId);
    const id = randomUUID();
    const document = createProjectDocument({ id, ownerId, ...input });
    return this.prisma.project.create({
      data: {
        id,
        ownerId,
        title: input.title,
        type: input.type,
        document: toJsonDocument(document),
      },
    });
  }

  async duplicate(ownerId: string, projectId: string): Promise<Project> {
    const source = await this.get(ownerId, projectId);
    const sourceDocument = readStoredDocument(source);
    await this.assertQuota(ownerId);
    const id = randomUUID();
    const title = copyTitle(source.title);
    const document = cloneProjectDocument(sourceDocument, { id, ownerId, title });
    return this.prisma.project.create({
      data: { id, ownerId, title, type: source.type, document: toJsonDocument(document) },
    });
  }

  async softDelete(ownerId: string, projectId: string): Promise<void> {
    if (!uuidSchema.safeParse(projectId).success) {
      throw notFound();
    }
    const result = await this.prisma.project.updateMany({
      where: { id: projectId, ownerId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw notFound();
    }
  }

  private async assertQuota(ownerId: string): Promise<void> {
    const used = await this.countActive(ownerId);
    if (used >= this.quota) {
      throw new ApiError({
        code: 'QUOTA_EXCEEDED',
        message: `Достигнут лимит проектов (${this.quota}). Удалите ненужные проекты`,
        details: { resource: 'projects', used, limit: this.quota },
      });
    }
  }
}
