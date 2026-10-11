import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

const cloudflareDevOrigin = /^https:\/\/[\w-]+\.trycloudflare\.com$/;
const loopbackOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // Railway terminates TLS in front of us; needed for per-IP auth rate limits.
  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '256kb' });

  const config = app.get(ConfigService<Env, true>);
  const corsOrigins = config
    .get('CREATOR_API_CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        corsOrigins.includes(origin) ||
        (nodeEnv === 'development' &&
          (cloudflareDevOrigin.test(origin) || loopbackOrigin.test(origin)))
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  return app;
}

export function resolvePort(app: INestApplication): number {
  const config = app.get(ConfigService<Env, true>);
  return config.get('PORT', { infer: true }) ?? config.get('CREATOR_API_PORT', { infer: true });
}
