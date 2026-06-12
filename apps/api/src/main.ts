import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get('API_PORT', { infer: true });
  const corsOrigins = configService
    .get('API_CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const cloudflareDevOrigin = /^https:\/\/[\w-]+\.trycloudflare\.com$/;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (nodeEnv === 'development' && cloudflareDevOrigin.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
