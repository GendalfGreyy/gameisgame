import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth/auth.controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { SessionService } from './auth/session.service.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { envSchema } from './config/env.schema.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ProjectsService } from './projects/projects.service.js';
import { MeController } from './users/me.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: (config) => envSchema.parse(config),
    }),
    PrismaModule,
    HealthModule,
  ],
  controllers: [AuthController, MeController, ProjectsController],
  providers: [
    SessionService,
    UsersService,
    ProjectsService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
