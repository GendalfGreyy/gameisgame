import type {
  CreateStudioProjectRequest,
  PublishStudioProjectResponse,
  StudioProjectDetail,
  StudioProjectListResponse,
  StudioProjectSummary,
  StudioScene,
  UpdateStudioProjectRequest,
} from '@game-is-game/shared';
import {
  buildMiniAppDeepLink,
  buildStudioSceneFromTemplate,
  encodeStudioGameStartParam,
  studioSceneSchema,
} from '@game-is-game/shared';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, StudioProject } from '@game-is-game/db';

import type { Env } from '../../config/env.schema.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type ProjectWithOwner = StudioProject & {
  owner: {
    id: string;
    username: string | null;
    firstName: string;
  };
};

@Injectable()
export class StudioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService<Env, true>,
  ) {}

  async listMine(ownerId: string): Promise<StudioProjectListResponse> {
    const rows = await this.prisma.studioProject.findMany({
      where: { ownerId, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return { items: rows.map((row) => this.toSummary(row)) };
  }

  async create(ownerId: string, input: CreateStudioProjectRequest): Promise<StudioProjectDetail> {
    const scene = buildStudioSceneFromTemplate(input.template);
    const created = await this.prisma.studioProject.create({
      data: {
        ownerId,
        title: input.title,
        description: input.description ?? null,
        scene: scene as Prisma.InputJsonValue,
        accentColor: scene.entities.find((e) => e.behaviors.includes('player'))?.color ?? '#3DDC97',
      },
      include: {
        owner: { select: { id: true, username: true, firstName: true } },
      },
    });
    return this.toDetail(created, ownerId);
  }

  async getById(projectId: string, viewerId: string | null): Promise<StudioProjectDetail> {
    const project = await this.prisma.studioProject.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, username: true, firstName: true } },
      },
    });
    if (!project || project.status === 'archived') {
      throw new NotFoundException('Project not found');
    }

    const isOwner = viewerId !== null && project.ownerId === viewerId;
    if (!isOwner && project.status !== 'published') {
      throw new ForbiddenException('This project is not published');
    }

    return this.toDetail(project, viewerId);
  }

  async update(
    ownerId: string,
    projectId: string,
    input: UpdateStudioProjectRequest,
  ): Promise<StudioProjectDetail> {
    const existing = await this.requireOwned(ownerId, projectId);

    const data: Prisma.StudioProjectUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.accentColor !== undefined) {
      data.accentColor = input.accentColor;
    }
    if (input.scene !== undefined) {
      const scene = studioSceneSchema.parse(input.scene);
      data.scene = scene as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.studioProject.update({
      where: { id: existing.id },
      data,
      include: {
        owner: { select: { id: true, username: true, firstName: true } },
      },
    });
    return this.toDetail(updated, ownerId);
  }

  async publish(ownerId: string, projectId: string): Promise<PublishStudioProjectResponse> {
    await this.requireOwned(ownerId, projectId);
    const publishedAt = new Date();
    const updated = await this.prisma.studioProject.update({
      where: { id: projectId },
      data: {
        status: 'published',
        publishedAt,
      },
    });
    const shareStartParam = encodeStudioGameStartParam(updated.id);
    const botUsername = this.configService.get('TELEGRAM_BOT_USERNAME', { infer: true });
    return {
      id: updated.id,
      status: 'published',
      publishedAt: publishedAt.toISOString(),
      shareStartParam,
      shareUrl: buildMiniAppDeepLink(botUsername, shareStartParam),
    };
  }

  async unpublish(ownerId: string, projectId: string): Promise<StudioProjectDetail> {
    await this.requireOwned(ownerId, projectId);
    const updated = await this.prisma.studioProject.update({
      where: { id: projectId },
      data: {
        status: 'draft',
        publishedAt: null,
      },
      include: {
        owner: { select: { id: true, username: true, firstName: true } },
      },
    });
    return this.toDetail(updated, ownerId);
  }

  async remove(ownerId: string, projectId: string): Promise<{ ok: true }> {
    await this.requireOwned(ownerId, projectId);
    await this.prisma.studioProject.update({
      where: { id: projectId },
      data: { status: 'archived' },
    });
    return { ok: true };
  }

  async recordPlay(projectId: string, viewerId: string | null): Promise<{ playCount: number }> {
    const project = await this.prisma.studioProject.findUnique({ where: { id: projectId } });
    if (!project || project.status === 'archived') {
      throw new NotFoundException('Project not found');
    }
    const isOwner = viewerId !== null && project.ownerId === viewerId;
    if (!isOwner && project.status !== 'published') {
      throw new ForbiddenException('This project is not published');
    }

    const updated = await this.prisma.studioProject.update({
      where: { id: projectId },
      data: { playCount: { increment: 1 } },
      select: { playCount: true },
    });
    return { playCount: updated.playCount };
  }

  private async requireOwned(ownerId: string, projectId: string): Promise<StudioProject> {
    const project = await this.prisma.studioProject.findUnique({ where: { id: projectId } });
    if (!project || project.status === 'archived') {
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('Not your project');
    }
    return project;
  }

  private parseScene(raw: Prisma.JsonValue): StudioScene {
    return studioSceneSchema.parse(raw);
  }

  private toSummary(row: StudioProject): StudioProjectSummary {
    const scene = this.parseScene(row.scene);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      accentColor: row.accentColor,
      playCount: row.playCount,
      entityCount: scene.entities.length,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDetail(row: ProjectWithOwner, viewerId: string | null): StudioProjectDetail {
    const summary = this.toSummary(row);
    return {
      ...summary,
      scene: this.parseScene(row.scene),
      owner: {
        id: row.owner.id,
        username: row.owner.username,
        firstName: row.owner.firstName,
      },
      isOwner: viewerId !== null && row.ownerId === viewerId,
    };
  }
}
