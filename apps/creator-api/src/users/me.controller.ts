import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import {
  updatePreferencesRequestSchema,
  type MeResponse,
  type UserPreferences,
} from '@tg-creator/shared';

import { CurrentAuth } from '../auth/session.guard.js';
import type { AuthContext } from '../auth/session.service.js';
import { parseRequest } from '../common/validation.js';
import { ProjectsService } from '../projects/projects.service.js';
import { UsersService, readPreferences, toProfile } from './users.service.js';

@Controller('api/v1/me')
export class MeController {
  private readonly users: UsersService;
  private readonly projects: ProjectsService;

  constructor(
    @Inject(UsersService) users: UsersService,
    @Inject(ProjectsService) projects: ProjectsService,
  ) {
    this.users = users;
    this.projects = projects;
  }

  @Get()
  async me(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    const [user, used] = await Promise.all([
      this.users.getById(auth.userId),
      this.projects.countActive(auth.userId),
    ]);
    return {
      user: toProfile(user),
      preferences: readPreferences(user.preferences),
      quotas: { projects: { used, limit: this.projects.projectQuota } },
      session: { expiresAt: auth.expiresAt.toISOString() },
    };
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentAuth() auth: AuthContext,
    @Body() body: unknown,
  ): Promise<UserPreferences> {
    return this.users.updatePreferences(
      auth.userId,
      parseRequest(updatePreferencesRequestSchema, body),
    );
  }
}
