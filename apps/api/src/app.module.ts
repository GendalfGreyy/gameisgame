import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { envSchema } from './config/env.schema.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CheckInsModule } from './modules/check-ins/check-ins.module.js';
import { DigestModule } from './modules/digest/digest.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { FriendsModule } from './modules/friends/friends.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { PointsModule } from './modules/points/points.module.js';
import { SquadsModule } from './modules/squads/squads.module.js';
import { StreaksModule } from './modules/streaks/streaks.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRoot(
      process.env.NODE_ENV === 'development'
        ? {
            pinoHttp: {
              level: process.env.LOG_LEVEL ?? 'info',
              transport: { target: 'pino-pretty', options: { colorize: true } },
            },
          }
        : {
            pinoHttp: {
              level: process.env.LOG_LEVEL ?? 'info',
            },
          },
    ),
    JwtModule.register({ global: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    EventsModule,
    CheckInsModule,
    PointsModule,
    StreaksModule,
    FriendsModule,
    SquadsModule,
    DigestModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
