import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  createProjectRequestSchema,
  listProjectsQuerySchema,
  saveDraftRequestSchema,
  type CreateProjectResponse,
  type ListProjectsResponse,
  type ProjectDetail,
  type ProjectDraftResponse,
  type SaveDraftResponse,
} from '@tg-creator/shared';
import type { Response } from 'express';

import { CurrentAuth } from '../auth/session.guard.js';
import type { AuthContext } from '../auth/session.service.js';
import { parseRequest } from '../common/validation.js';
import { ProjectsService, toSummary } from './projects.service.js';

@Controller('api/v1/projects')
export class ProjectsController {
  private readonly projects: ProjectsService;

  constructor(@Inject(ProjectsService) projects: ProjectsService) {
    this.projects = projects;
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: unknown): Promise<ListProjectsResponse> {
    return this.projects.list(auth.userId, parseRequest(listProjectsQuerySchema, query));
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
  ): Promise<CreateProjectResponse> {
    const project = await this.projects.create(
      auth.userId,
      parseRequest(createProjectRequestSchema, body),
    );
    return { projectId: project.id, revision: project.revision, project: toSummary(project) };
  }

  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<ProjectDetail> {
    return toSummary(await this.projects.get(auth.userId, id));
  }

  @Get(':id/draft')
  async draft(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProjectDraftResponse> {
    const draft = await this.projects.getDraft(auth.userId, id);
    response.setHeader('ETag', draft.etag);
    response.setHeader('Cache-Control', 'no-store');
    return draft;
  }

  @Put(':id/draft')
  async saveDraft(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SaveDraftResponse> {
    const saved = await this.projects.saveDraft(
      auth.userId,
      id,
      parseRequest(saveDraftRequestSchema, body),
    );
    response.setHeader('ETag', saved.etag);
    return saved;
  }

  @Post(':id/duplicate')
  @HttpCode(201)
  async duplicate(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ): Promise<CreateProjectResponse> {
    const project = await this.projects.duplicate(auth.userId, id);
    return { projectId: project.id, revision: project.revision, project: toSummary(project) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.projects.softDelete(auth.userId, id);
  }
}
