import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cloneProjectDocument,
  createProjectDocument,
  migrateToLatest,
  serializeProjectDocument,
  type ProjectDocument,
} from '@tg-creator/project-schema';
import {
  ApiError,
  PROJECT_TITLE_MAX,
  type ListProjectsResponse,
  type ProjectDraftResponse,
  type ProjectSummary,
} from '@tg-creator/shared';
import { z } from 'zod';

import type { Prisma, Project } from '../../generated/client/index.js';
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
    const migrated = migrateToLatest(project.document);
    if (!migrated.ok) {
      throw new ApiError({
        code: 'MIGRATION_FAILED',
        message: 'Не удалось открыть документ проекта',
        details: { reason: migrated.reason },
      });
    }
    return { projectId: project.id, revision: project.revision, document: migrated.document };
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
    const migrated = migrateToLatest(source.document);
    if (!migrated.ok) {
      throw new ApiError({
        code: 'MIGRATION_FAILED',
        message: 'Не удалось скопировать документ проекта',
        details: { reason: migrated.reason },
      });
    }
    await this.assertQuota(ownerId);
    const id = randomUUID();
    const title = copyTitle(source.title);
    const document = cloneProjectDocument(migrated.document, { id, ownerId, title });
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
